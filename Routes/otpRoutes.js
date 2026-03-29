const express = require("express");
const router = express.Router();
const {
  sendPlayerOtp,
  verifyPlayerOtp,
  sendPasswordOtp,
  verifyPasswordOtp,
} = require("../services/otpController");
const { protect, authorize } = require("../Middleware/authMiddleware");
const { createLimiter } = require("../Middleware/rateLimiter");

// All OTP routes are protected (require authentication)
router.use(protect);

// Player creation OTP — Super Admin only (rate-limited)
router.post(
  "/send-player-otp",
  authorize("Admin", "Super Admin"),
  createLimiter,
  sendPlayerOtp
);
router.post(
  "/verify-player-otp",
  authorize("Admin", "Super Admin"),
  verifyPlayerOtp
);

// Change password OTP — any authenticated admin (rate-limited)
router.post("/send-password-otp", createLimiter, sendPasswordOtp);
router.post("/verify-password-otp", verifyPasswordOtp);

module.exports = router;
