const Admin = require("../Models/Admin");
const Otp = require("../Models/Otp");
const generateToken = require("../services/generateToken");
const { logAction } = require("../Middleware/auditLogger");
const { AppError, catchAsync } = require("../Middleware/errorHandler");

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

  res.status(200).json({
    _id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    profile_image: admin.profile_image,
    is_active: admin.is_active,
    last_login: admin.last_login,
    token: generateToken(admin._id, admin.role),
  });
});

// @desc    Register a new admin (Super Admin only)
// @route   POST /api/auth/register
// @access  Private / Super Admin
const registerAdmin = catchAsync(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    throw new AppError("Please provide name, email, and password", 400);
  }

  const existingAdmin = await Admin.findOne({ email });

  if (existingAdmin) {
    throw new AppError("Admin with this email already exists", 409);
  }

  const admin = await Admin.create({
    name,
    email,
    password,
    role: role || "Admin",
  });

  await logAction({
    user: req.admin,
    action: "CREATE",
    resourceType: "Admin",
    resourceId: admin._id.toString(),
    description: `New admin registered: ${admin.name} (${admin.email}) with role ${admin.role}`,
    req,
    changes: { name, email, role: admin.role },
    status: "SUCCESS"
  });

  res.status(201).json({
    _id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    token: generateToken(admin._id, admin.role),
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

  const newToken = generateToken(admin._id, admin.role);

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

module.exports = { loginAdmin, registerAdmin, getProfile, changePassword, updateAdminRole, logoutAdmin, refreshToken, logoutAdmin, refreshToken };
