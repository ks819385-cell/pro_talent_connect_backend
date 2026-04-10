const Admin = require("../Models/Admin");
const Otp = require("../Models/Otp");
const bcrypt = require("bcryptjs");
const generateToken = require("../services/generateToken");
const { generateOTP, sendAdminInviteEmail, sendWelcomeEmail } = require("./emailService");
const { logAction } = require("../Middleware/auditLogger");
const { AppError, catchAsync } = require("../Middleware/errorHandler");

const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
};

const ACTIVATION_OTP_PURPOSE = "admin-activation";
const ACTIVATION_OTP_EXPIRY_MINUTES = 72 * 60;

const mapEmailErrorMessage = (emailErr) => {
  if (!emailErr || !emailErr.message) {
    return "Failed to send OTP. Please try again.";
  }

  const message = emailErr.message.toLowerCase();

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

  return "Failed to send OTP. Please try again.";
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
  const configuredBase =
    process.env.ADMIN_ACTIVATION_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:5173/admin-activate";
  const normalizedBase = configuredBase.includes("/admin-activate")
    ? configuredBase
    : `${configuredBase.replace(/\/+$/, "")}/admin-activate`;
  const params = new URLSearchParams({ email });
  const separator = normalizedBase.includes("?") ? "&" : "?";
  return `${normalizedBase}${separator}${params.toString()}`;
};

const matchesOtp = async (plainOtp, storedValue) => {
  if (!storedValue) return false;
  if (storedValue.startsWith("$2a$") || storedValue.startsWith("$2b$") || storedValue.startsWith("$2y$")) {
    return bcrypt.compare(plainOtp, storedValue);
  }
  return plainOtp === storedValue;
};

const issueActivationOtp = async (email, role = "Admin") => {
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
    return expiresAt;
  }

  await sendAdminInviteEmail(email, otp, buildActivationLink(email), role);
  return expiresAt;
};

// @desc    Login admin
// @route   POST /api/auth/login
// @access  Public
const loginAdmin = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("Please provide email and password", 400);
  }

  const admin = await Admin.findOne({ email });

  if (!admin) {
    await logAction({
      user: { email },
      action: "LOGIN",
      resourceType: "Auth",
      description: `Failed login attempt for email: ${email}`,
      req,
      status: "FAILURE"
    });
    throw new AppError("Invalid email or password", 401);
  }

  if (!admin.is_active) {
    await logAction({
      user: admin,
      action: "LOGIN",
      resourceType: "Auth",
      description: `Login attempt on deactivated account: ${admin.email}`,
      req,
      status: "FAILURE"
    });
    throw new AppError("Account is deactivated. Contact administrator", 403);
  }

  if (admin.activation_required || !admin.is_password_set) {
    await logAction({
      user: admin,
      action: "LOGIN",
      resourceType: "Auth",
      description: `Login blocked: activation pending for ${admin.email}`,
      req,
      status: "FAILURE"
    });

    return res.status(403).json({
      success: false,
      code: "ACTIVATION_REQUIRED",
      activationRequired: true,
      message: "Account activation is pending. Verify OTP and set your password to continue.",
      email: admin.email,
    });
  }

  const isMatch = await admin.matchPassword(password);

  if (!isMatch) {
    await logAction({
      user: admin,
      action: "LOGIN",
      resourceType: "Auth",
      description: `Failed login attempt with incorrect password for: ${admin.email}`,
      req,
      status: "FAILURE"
    });
    throw new AppError("Invalid email or password", 401);
  }

  admin.last_login = new Date();
  await admin.save();

  await logAction({
    user: admin,
    action: "LOGIN",
    resourceType: "Auth",
    description: `Admin ${admin.name} logged in successfully`,
    req,
    status: "SUCCESS"
  });

  const token = generateToken(admin._id, admin.role);
  res.cookie("adminToken", token, getCookieOptions());

  res.status(200).json({
    _id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    profile_image: admin.profile_image,
    is_active: admin.is_active,
    last_login: admin.last_login,
    token,
    csrfToken: req.csrfToken(),
  });
});

// @desc    Register a new admin (Super Admin only)
// @route   POST /api/auth/register
// @access  Private / Super Admin
const registerAdmin = catchAsync(async (req, res) => {
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
    activation_required: true,
    is_password_set: false,
    invited_at: new Date(),
    activation_completed_at: null,
  });

  try {
    await issueActivationOtp(email, role);
  } catch (emailErr) {
    console.error("Activation OTP issuance failed:", emailErr.message);
    await Admin.findByIdAndDelete(admin._id);
    throw new AppError(mapEmailErrorMessage(emailErr), 503);
  }

  await logAction({
    user: req.admin,
    action: "CREATE",
    resourceType: "Admin",
    resourceId: admin._id.toString(),
    description: `New admin invite created for ${admin.email} with role ${admin.role}`,
    req,
    changes: { email, role: admin.role, activation_required: true },
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
      activation_required: admin.activation_required,
      is_password_set: admin.is_password_set,
      invited_at: admin.invited_at,
      is_active: admin.is_active,
    },
  });
});

// @desc    Get current admin profile and list all admins
// @route   GET /api/auth/profile
// @access  Private
const getProfile = catchAsync(async (req, res) => {
  const admin = await Admin.findById(req.admin._id).select("-password");
  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  const allAdmins = await Admin.find()
    .select("name email role createdAt")
    .sort({ createdAt: -1 });

  const superAdmins = allAdmins.filter((a) => a.role === "Super Admin");
  const regularAdmins = allAdmins.filter((a) => a.role === "Admin");

  res.status(200).json({
    currentAdmin: admin,
    adminsList: {
      superAdmins: superAdmins,
      admins: regularAdmins,
      totalCount: allAdmins.length,
      superAdminCount: superAdmins.length,
      adminCount: regularAdmins.length,
    },
  });
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError("Please provide current and new password", 400);
  }

  const admin = await Admin.findById(req.admin._id);

  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  const isMatch = await admin.matchPassword(currentPassword);

  if (!isMatch) {
    throw new AppError("Current password is incorrect", 401);
  }

  const verifiedOtp = await Otp.findOne({
    email: admin.email,
    purpose: "change-password",
    verified: true,
  });

  if (!verifiedOtp || verifiedOtp.expiresAt < new Date()) {
    throw new AppError("Email OTP verification is required before changing password", 400);
  }

  await Otp.deleteMany({ email: admin.email, purpose: "change-password" });

  admin.password = newPassword;
  await admin.save();

  await logAction({
    user: admin,
    action: "PASSWORD_CHANGE",
    resourceType: "Auth",
    resourceId: admin._id.toString(),
    description: `Admin ${admin.name} changed password`,
    req,
    status: "SUCCESS"
  });

  res.status(200).json({ message: "Password changed successfully" });
});

// @desc    Reset password via forgot-password flow
// @route   POST /api/auth/forgot-password/reset
// @access  Public
const resetForgotPassword = catchAsync(async (req, res) => {
  const email = req.body?.email?.trim()?.toLowerCase();
  const newPassword = req.body?.newPassword;

  if (!email || !newPassword) {
    throw new AppError("Email and new password are required", 400);
  }

  const admin = await Admin.findOne({ email, is_active: true });

  if (!admin) {
    throw new AppError("Invalid or expired verification", 400);
  }

  const verifiedOtp = await Otp.findOne({
    email,
    purpose: "forgot-password",
    verified: true,
  });

  if (!verifiedOtp || verifiedOtp.expiresAt < new Date()) {
    throw new AppError("Email OTP verification is required", 400);
  }

  await Otp.deleteMany({ email, purpose: "forgot-password" });

  admin.password = newPassword;
  await admin.save();

  await logAction({
    user: admin,
    action: "PASSWORD_RESET",
    resourceType: "Auth",
    resourceId: admin._id.toString(),
    description: `Admin ${admin.name} reset password via forgot-password flow`,
    req,
    status: "SUCCESS"
  });

  res.status(200).json({ message: "Password reset successfully" });
});

// @desc    Resend activation OTP for pending admin invite
// @route   POST /api/auth/resend-activation-otp
// @access  Public
const resendActivationOtp = catchAsync(async (req, res) => {
  const email = req.body?.email?.trim()?.toLowerCase();

  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const admin = await Admin.findOne({ email });

  if (!admin || !admin.is_active || !admin.activation_required || admin.is_password_set) {
    return res.status(200).json({
      message: "If a pending invite exists for this email, a new OTP has been sent",
    });
  }

  try {
    await issueActivationOtp(email, admin.role);
  } catch (emailErr) {
    throw new AppError(mapEmailErrorMessage(emailErr), 503);
  }

  await logAction({
    user: admin,
    action: "UPDATE",
    resourceType: "Auth",
    resourceId: admin._id.toString(),
    description: `Activation OTP resent for ${admin.email}`,
    req,
    status: "SUCCESS"
  });

  res.status(200).json({
    message: "Activation OTP sent successfully. This OTP is valid for 72 hours.",
  });
});

// @desc    Activate invited admin account and set first password
// @route   POST /api/auth/activate-admin
// @access  Public
const activateAdmin = catchAsync(async (req, res) => {
  const email = req.body?.email?.trim()?.toLowerCase();
  const name = req.body?.name?.trim();
  const otp = req.body?.otp?.trim();
  const newPassword = req.body?.newPassword;

  if (!email || !name || !otp || !newPassword) {
    throw new AppError("Email, name, OTP, and new password are required", 400);
  }

  const admin = await Admin.findOne({ email });

  if (!admin || !admin.is_active) {
    throw new AppError("Invalid or expired activation request", 400);
  }

  if (!admin.activation_required && admin.is_password_set) {
    throw new AppError("Account is already activated", 400);
  }

  const record = await Otp.findOne({
    email,
    purpose: ACTIVATION_OTP_PURPOSE,
  });

  const isOtpValid = record && await matchesOtp(otp, record.otp);
  if (!record || !isOtpValid || record.expiresAt < new Date()) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  record.verified = true;
  await record.save();

  admin.name = name;
  admin.password = newPassword;
  admin.activation_required = false;
  admin.is_password_set = true;
  admin.activation_completed_at = new Date();
  await admin.save();

  await Otp.deleteMany({ email, purpose: ACTIVATION_OTP_PURPOSE });

  await logAction({
    user: admin,
    action: "UPDATE",
    resourceType: "Auth",
    resourceId: admin._id.toString(),
    description: `Admin account activated: ${admin.email}`,
    req,
    changes: { activation_required: false, is_password_set: true, name: admin.name },
    status: "SUCCESS"
  });

  try {
    await sendWelcomeEmail(admin.email, admin.name);
  } catch (welcomeErr) {
    console.error("Welcome email failed:", welcomeErr.message);
  }

  admin.last_login = new Date();
  await admin.save();

  const token = generateToken(admin._id, admin.role);
  res.cookie("adminToken", token, getCookieOptions());

  res.status(200).json({
    success: true,
    message: "Account activated successfully",
    _id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    profile_image: admin.profile_image,
    is_active: admin.is_active,
    activation_required: admin.activation_required,
    is_password_set: admin.is_password_set,
    last_login: admin.last_login,
    token,
    csrfToken: req.csrfToken(),
  });
});

// @desc    Update admin role
// @route   PUT /api/auth/admin/:id/role
// @access  Private / Super Admin only
const updateAdminRole = catchAsync(async (req, res) => {
  const { role } = req.body;

  if (!role || !["Admin", "Super Admin"].includes(role)) {
    throw new AppError("Please provide a valid role (Admin or Super Admin)", 400);
  }

  const admin = await Admin.findById(req.params.id);

  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  if (req.admin._id.toString() === admin._id.toString() && role === "Admin") {
    const superAdminCount = await Admin.countDocuments({ role: "Super Admin" });
    if (superAdminCount <= 1) {
      throw new AppError("Cannot demote the last Super Admin", 403);
    }
  }

  const oldRole = admin.role;
  admin.role = role;
  await admin.save();

  await logAction({
    user: req.admin,
    action: "ROLE_CHANGE",
    resourceType: "Admin",
    resourceId: admin._id.toString(),
    description: `Admin role updated from ${oldRole} to ${role} for ${admin.name}`,
    req,
    changes: { oldRole, newRole: role },
    status: "SUCCESS"
  });

  res.status(200).json({
    message: `Admin role updated to ${role} successfully`,
    admin: {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
  });
});

// @desc    Logout admin
// @route   POST /api/auth/logout
// @access  Private
const logoutAdmin = catchAsync(async (req, res) => {
  await logAction({
    user: req.admin,
    action: "LOGOUT",
    resourceType: "Auth",
    description: `Admin ${req.admin.name} logged out`,
    req,
    status: "SUCCESS"
  });

  res.clearCookie("adminToken", {
    ...getCookieOptions(),
    maxAge: undefined,
    expires: new Date(0),
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

// @desc    Refresh JWT token
// @route   POST /api/auth/refresh
// @access  Private
const refreshToken = catchAsync(async (req, res) => {
  const admin = await Admin.findById(req.admin._id).select("-password");

  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  if (!admin.is_active) {
    throw new AppError("Account is deactivated", 403);
  }

  if (admin.activation_required || !admin.is_password_set) {
    throw new AppError("Account activation is pending", 403);
  }

  const newToken = generateToken(admin._id, admin.role);
  res.cookie("adminToken", newToken, getCookieOptions());

  res.status(200).json({
    success: true,
    token: newToken,
    admin: {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      profile_image: admin.profile_image,
    },
  });
});

module.exports = {
  loginAdmin,
  registerAdmin,
  resendActivationOtp,
  activateAdmin,
  getProfile,
  changePassword,
  resetForgotPassword,
  updateAdminRole,
  logoutAdmin,
  refreshToken,
};
