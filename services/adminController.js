const Admin = require("../Models/Admin");
const Otp = require("../Models/Otp");
const bcrypt = require("bcryptjs");
const { generateOTP, sendAdminInviteEmail } = require("./emailService");
const { logAction } = require("../Middleware/auditLogger");
const { AppError, catchAsync } = require("../Middleware/errorHandler");

const ACTIVATION_OTP_PURPOSE = "admin-activation";
const ACTIVATION_OTP_EXPIRY_MINUTES = 72 * 60;

const mapInviteEmailErrorMessage = (emailErr) => {
  const message = (emailErr?.message || "").toLowerCase();

  if (
    message.includes("activation link") ||
    message.includes("activation url") ||
    message.includes("frontend_url") ||
    message.includes("admin_activation_url")
  ) {
    return "Activation link is not configured for production. Set ADMIN_ACTIVATION_URL or FRONTEND_URL.";
  }

  if (message.includes("email not configured")) {
    return "Email service is not configured on the server. Contact admin.";
  }

  if (message.includes("invalid login") || message.includes("auth")) {
    return "Email authentication failed. Check SMTP_* or EMAIL_USER/EMAIL_PASS.";
  }

  if (
    message.includes("etimedout") ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("econnrefused") ||
    message.includes("ehostunreach") ||
    message.includes("enotfound")
  ) {
    return "Unable to reach email server. Check SMTP_HOST/SMTP_PORT and firewall/network settings.";
  }

  return "Failed to send activation OTP. Please try again.";
};

const createTemporaryPassword = () => `Tmp@${Math.random().toString(36).slice(2, 10)}A1!`;

const buildOtp = () => {
  const generatedOtp = typeof generateOTP === "function" ? generateOTP() : null;
  if (generatedOtp) {
    return generatedOtp;
  }
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const hashOtp = async (otp) => bcrypt.hash(otp, 10);

const buildActivationLink = (email) => {
  const configuredBase = (process.env.ADMIN_ACTIVATION_URL || process.env.FRONTEND_URL || "").trim();

  if (!configuredBase) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Activation URL is missing. Configure ADMIN_ACTIVATION_URL or FRONTEND_URL in production.",
      );
    }

    const localBase = "http://localhost:5173/admin-activate";
    const params = new URLSearchParams({ email });
    return `${localBase}?${params.toString()}`;
  }

  const normalizedBase = configuredBase.includes("/admin-activate")
    ? configuredBase
    : `${configuredBase.replace(/\/+$/, "")}/admin-activate`;

  if (
    process.env.NODE_ENV === "production" &&
    /localhost|127\.0\.0\.1/i.test(normalizedBase)
  ) {
    throw new Error(
      "Activation URL points to localhost in production. Set ADMIN_ACTIVATION_URL or FRONTEND_URL to your live frontend domain.",
    );
  }

  const params = new URLSearchParams({ email });
  const separator = normalizedBase.includes("?") ? "&" : "?";
  return `${normalizedBase}${separator}${params.toString()}`;
};

const createAndSendActivationOtp = async (email, role) => {
  await Otp.deleteMany({ email, purpose: ACTIVATION_OTP_PURPOSE });

  const otp = buildOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + ACTIVATION_OTP_EXPIRY_MINUTES * 60 * 1000);

  await Otp.create({
    email,
    otp: otpHash,
    purpose: ACTIVATION_OTP_PURPOSE,
    expiresAt,
  });

  if (process.env.NODE_ENV === "test") {
    return;
  }

  await sendAdminInviteEmail(email, otp, buildActivationLink(email), role);
};

// @desc    List all admin accounts
// @route   GET /api/admins
// @access  Private / Super Admin only
const getAllAdmins = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.role) {
    filter.role = req.query.role;
  }

  if (req.query.is_active !== undefined) {
    filter.is_active = req.query.is_active === "true";
  }

  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: "i" } },
      { email: { $regex: req.query.search, $options: "i" } },
    ];
  }

  const totalResults = await Admin.countDocuments(filter);
  const totalPages = Math.ceil(totalResults / limit);

  const admins = await Admin.find(filter)
    .select("-password")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    count: admins.length,
    totalResults,
    totalPages,
    currentPage: page,
    admins,
  });
});

// @desc    Create a new admin account
// @route   POST /api/admins
// @access  Private / Super Admin only
const createAdmin = catchAsync(async (req, res) => {
  const email = req.body?.email?.trim()?.toLowerCase();
  const role = req.body?.role || "Admin";

  if (!email) {
    throw new AppError("Please provide email", 400);
  }

  const existingAdmin = await Admin.findOne({ email });

  if (existingAdmin) {
    if (existingAdmin.activation_required) {
      throw new AppError("An invite is already pending for this email", 409);
    }
    throw new AppError("Admin with this email already exists", 409);
  }

  const admin = await Admin.create({
    name: "Pending Admin",
    email,
    password: createTemporaryPassword(),
    role,
    profile_image: "",
    is_active: true,
    activation_required: true,
    is_password_set: false,
    invited_at: new Date(),
    activation_completed_at: null,
  });

  try {
    await createAndSendActivationOtp(email, role);
  } catch (emailErr) {
    await Admin.findByIdAndDelete(admin._id);
    console.error("Invite OTP email failed:", emailErr.message);
    throw new AppError(mapInviteEmailErrorMessage(emailErr), 503);
  }

  await logAction({
    user: req.admin,
    action: "CREATE",
    resourceType: "Admin",
    resourceId: admin._id.toString(),
    description: `Admin invite created for ${admin.email} with role ${admin.role}`,
    req,
    changes: { email, role: admin.role, activation_required: true, is_active: true },
    status: "SUCCESS"
  });

  res.status(201).json({
    success: true,
    message: "Admin invite sent successfully. Activation OTP is valid for 72 hours.",
    admin: {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      profile_image: admin.profile_image,
      is_active: admin.is_active,
      activation_required: admin.activation_required,
      is_password_set: admin.is_password_set,
      invited_at: admin.invited_at,
      createdAt: admin.createdAt,
    },
  });
});

// @desc    Withdraw pending admin invite
// @route   PATCH /api/admins/:id/withdraw-invite
// @access  Private / Super Admin only
const withdrawInvite = catchAsync(async (req, res) => {
  const admin = await Admin.findById(req.params.id);

  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  if (req.admin._id.toString() === admin._id.toString()) {
    throw new AppError("Cannot withdraw your own account invite", 403);
  }

  const isPendingInvite = admin.activation_required || !admin.is_password_set;
  if (!isPendingInvite) {
    throw new AppError("Only pending invites can be withdrawn", 400);
  }

  await Otp.deleteMany({
    email: admin.email,
    purpose: ACTIVATION_OTP_PURPOSE,
  });

  await Admin.findByIdAndDelete(admin._id);

  await logAction({
    user: req.admin,
    action: "DELETE",
    resourceType: "Admin",
    resourceId: admin._id.toString(),
    description: `Admin invite withdrawn: ${admin.email}`,
    req,
    changes: { withdrawn_invite: { email: admin.email, role: admin.role } },
    status: "SUCCESS"
  });

  res.status(200).json({
    success: true,
    message: "Invite withdrawn successfully",
  });
});

// @desc    View admin profile by ID
// @route   GET /api/admins/:id
// @access  Private / Super Admin only
const getAdminById = catchAsync(async (req, res) => {
  const admin = await Admin.findById(req.params.id).select("-password");

  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  res.status(200).json({
    success: true,
    admin,
  });
});

// @desc    Update admin details
// @route   PUT /api/admins/:id
// @access  Private / Super Admin only
const updateAdmin = catchAsync(async (req, res) => {
  const admin = await Admin.findById(req.params.id);

  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  const updatableFields = ["name", "email", "role", "profile_image", "is_active"];

  updatableFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      admin[field] = req.body[field];
    }
  });

  if (req.body.role && !["Admin", "Super Admin"].includes(req.body.role)) {
    throw new AppError("Invalid role. Must be 'Admin' or 'Super Admin'", 400);
  }

  if (req.body.role === "Admin" && admin.role === "Super Admin") {
    const superAdminCount = await Admin.countDocuments({ role: "Super Admin" });
    if (superAdminCount <= 1) {
      throw new AppError("Cannot demote the last Super Admin", 403);
    }
  }

  const updatedAdmin = await admin.save();

  await logAction({
    user: req.admin,
    action: "UPDATE",
    resourceType: "Admin",
    resourceId: admin._id.toString(),
    description: `Admin details updated for ${updatedAdmin.name}`,
    req,
    changes: req.body,
    status: "SUCCESS"
  });

  res.status(200).json({
    success: true,
    message: "Admin details updated successfully",
    admin: {
      _id: updatedAdmin._id,
      name: updatedAdmin.name,
      email: updatedAdmin.email,
      role: updatedAdmin.role,
      profile_image: updatedAdmin.profile_image,
      is_active: updatedAdmin.is_active,
      last_login: updatedAdmin.last_login,
      updatedAt: updatedAdmin.updatedAt,
    },
  });
});

// @desc    Demote admin or deactivate account
// @route   PATCH /api/admins/:id/demote
// @access  Private / Super Admin only
const demoteAdmin = catchAsync(async (req, res) => {
  const admin = await Admin.findById(req.params.id);

  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  if (admin.role === "Super Admin") {
    const superAdminCount = await Admin.countDocuments({ role: "Super Admin" });
    if (superAdminCount <= 1) {
      throw new AppError("Cannot demote the last Super Admin", 403);
    }
    admin.role = "Admin";
  }

  admin.is_active = false;

  const oldRole = admin.role === "Admin" ? "Admin" : "Super Admin";
  await admin.save();

  await logAction({
    user: req.admin,
    action: "UPDATE",
    resourceType: "Admin",
    resourceId: admin._id.toString(),
    description: `Admin demoted and deactivated: ${admin.name} (from ${oldRole} to ${admin.role})`,
    req,
    changes: { role: admin.role, is_active: false },
    status: "SUCCESS"
  });

  res.status(200).json({
    success: true,
    message: "Admin demoted and deactivated successfully",
    admin: {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      is_active: admin.is_active,
    },
  });
});

// @desc    Delete admin account
// @route   DELETE /api/admins/:id
// @access  Private / Super Admin only
const deleteAdmin = catchAsync(async (req, res) => {
  const admin = await Admin.findById(req.params.id);

  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  if (admin.role === "Super Admin") {
    const superAdminCount = await Admin.countDocuments({ role: "Super Admin" });
    if (superAdminCount <= 1) {
      throw new AppError("Cannot delete the last Super Admin", 403);
    }
  }

  if (req.admin._id.toString() === admin._id.toString()) {
    throw new AppError("Cannot delete your own account", 403);
  }

  await Admin.findByIdAndDelete(req.params.id);

  await logAction({
    user: req.admin,
    action: "DELETE",
    resourceType: "Admin",
    resourceId: admin._id.toString(),
    description: `Admin account deleted: ${admin.name} (${admin.email})`,
    req,
    changes: { deleted_admin: { name: admin.name, email: admin.email, role: admin.role } },
    status: "SUCCESS"
  });

  res.status(200).json({
    success: true,
    message: "Admin account deleted successfully",
  });
});

module.exports = {
  getAllAdmins,
  createAdmin,
  getAdminById,
  updateAdmin,
  withdrawInvite,
  demoteAdmin,
  deleteAdmin,
};
