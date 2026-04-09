const express = require("express");
const router = express.Router();
const {
  loginAdmin,
  registerAdmin,
  getProfile,
  changePassword,
  resetForgotPassword,
  updateAdminRole,
  logoutAdmin,
  refreshToken,
} = require("../services/authController");
const { protect, authorize } = require("../Middleware/authMiddleware");
const { authLimiter } = require("../Middleware/rateLimiter");
const {
  validate,
  loginSchema,
  registerAdminSchema,
  changePasswordSchema,
  forgotPasswordResetSchema,
} = require("../Middleware/validator");

// CSRF token endpoint - returns token for frontend to use on state-changing requests
router.get("/csrf-token", (req, res) => {
  res.json({
    success: true,
    csrfToken: req.csrfToken(),
  });
});

// Public - with strict rate limiting
router.post("/login", authLimiter, validate(loginSchema), loginAdmin);
router.post("/forgot-password/reset", authLimiter, validate(forgotPasswordResetSchema), resetForgotPassword);

// Protected routes
router.post("/logout", protect, logoutAdmin);
router.post("/refresh", protect, refreshToken);

// Super Admin only — register new admins
router.post(
  "/register",
  protect,
  authorize("Super Admin"),
  validate(registerAdminSchema),
  registerAdmin
);

// Any authenticated admin
router.get("/profile", protect, getProfile);

// Change password — any authenticated admin
router.put("/change-password", protect, validate(changePasswordSchema), changePassword);

// Update admin role — Super Admin only
router.put("/admin/:id/role", protect, authorize("Super Admin"), updateAdminRole);

module.exports = router;
