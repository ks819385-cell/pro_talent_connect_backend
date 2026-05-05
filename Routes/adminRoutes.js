const express = require("express");
const router = express.Router();
const {
  getAllAdmins,
  createAdmin,
  getAdminById,
  updateAdmin,
  withdrawInvite,
  demoteAdmin,
  deleteAdmin,
  recalculateAllScores,
} = require("../services/adminController");
const { protect, authorize } = require("../Middleware/authMiddleware");
const { validate, inviteAdminSchema } = require("../Middleware/validator");

// All routes require Super Admin privileges
router.use(protect, authorize("Super Admin"));

// List all admin accounts
router.get("/", getAllAdmins);

// Recalculate scout scores for all players
router.post("/actions/recalculate-scores", recalculateAllScores);

// Create a new admin account
router.post("/", validate(inviteAdminSchema), createAdmin);

// Get admin by ID
router.get("/:id", getAdminById);

// Update admin details
router.put("/:id", updateAdmin);

// Withdraw pending invite
router.patch("/:id/withdraw-invite", withdrawInvite);

// Demote and deactivate admin account
router.patch("/:id/demote", demoteAdmin);

// Delete admin account
router.delete("/:id", deleteAdmin);

module.exports = router;
