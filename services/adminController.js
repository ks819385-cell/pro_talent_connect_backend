const Admin = require("../Models/Admin");
const generateToken = require("../services/generateToken");
const { logAction } = require("../Middleware/auditLogger");
const { AppError, catchAsync } = require("../Middleware/errorHandler");

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
  const { name, email, password, role, profile_image } = req.body;

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
    profile_image: profile_image || "",
    is_active: true,
  });

  await logAction({
    user: req.admin,
    action: "CREATE",
    resourceType: "Admin",
    resourceId: admin._id.toString(),
    description: `Admin account created: ${admin.name} (${admin.email}) with role ${admin.role}`,
    req,
    changes: { name, email, role: admin.role, is_active: true },
    status: "SUCCESS"
  });

  res.status(201).json({
    success: true,
    message: "Admin account created successfully",
    admin: {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      profile_image: admin.profile_image,
      is_active: admin.is_active,
      createdAt: admin.createdAt,
    },
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
  demoteAdmin,
  deleteAdmin,
};
