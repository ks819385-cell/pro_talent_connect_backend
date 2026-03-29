const express = require("express");
const router = express.Router();
const {
  getAllAdmins,
  createAdmin,
  getAdminById,
  updateAdmin,
  demoteAdmin,
  deleteAdmin,
} = require("../services/adminController");
const { protect, authorize } = require("../Middleware/authMiddleware");

// All routes require Super Admin privileges
router.use(protect, authorize("Super Admin"));

// List all admin accounts
router.get("/", getAllAdmins);

// Create a new admin account
router.post("/", createAdmin);

// Get admin by ID
router.get("/:id", getAdminById);

// Update admin details
router.put("/:id", updateAdmin);

// Demote and deactivate admin account
router.patch("/:id/demote", demoteAdmin);

// Delete admin account
router.delete("/:id", deleteAdmin);

module.exports = router;
