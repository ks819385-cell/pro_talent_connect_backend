const express = require("express");
const router = express.Router();
const {
  sendPlayerOtp,
  verifyPlayerOtp,
  sendPasswordOtp,
  verifyPasswordOtp,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
} = require("../services/otpController");
const { protect, authorize } = require("../Middleware/authMiddleware");
const { createLimiter, authLimiter } = require("../Middleware/rateLimiter");
const {
  validate,
  emailSchema,
  verifyOtpWithEmailSchema,
  verifyOtpSchema,
} = require("../Middleware/validator");

// Public forgot-password OTP routes
router.post("/send-forgot-password-otp", authLimiter, validate(emailSchema), sendForgotPasswordOtp);
router.post("/verify-forgot-password-otp", authLimiter, validate(verifyOtpWithEmailSchema), verifyForgotPasswordOtp);

// All OTP routes are protected (require authentication)
router.use(protect);

// Player creation OTP — Super Admin only (rate-limited)
router.post(
  "/send-player-otp",
  authorize("Admin", "Super Admin"),
  createLimiter,
  validate(emailSchema),
  sendPlayerOtp
);
router.post(
  "/verify-player-otp",
  authorize("Admin", "Super Admin"),
  validate(verifyOtpWithEmailSchema),
  verifyPlayerOtp
);

// Change password OTP — any authenticated admin (rate-limited)
router.post("/send-password-otp", createLimiter, sendPasswordOtp);
router.post("/verify-password-otp", validate(verifyOtpSchema), verifyPasswordOtp);

module.exports = router;
