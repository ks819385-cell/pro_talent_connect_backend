const Otp = require("../Models/Otp");
const Admin = require("../Models/Admin");
const { generateOTP, sendOTPEmail } = require("./emailService");
const { AppError, catchAsync } = require("../Middleware/errorHandler");

const OTP_EXPIRY_MINUTES = 10;

// ────────────────────────────────────────────────────
//  Send OTP for Player Creation
// ────────────────────────────────────────────────────
// @desc    Send OTP to the player's email before creating profile
// @route   POST /api/otp/send-player-otp
// @access  Private / Super Admin
const sendPlayerOtp = catchAsync(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError("Email is required", 400);
  }

  await Otp.deleteMany({ email, purpose: "player-creation" });

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await Otp.create({ email, otp, purpose: "player-creation", expiresAt });

  try {
    await sendOTPEmail(email, otp, "player-creation");
  } catch (emailErr) {
    console.error("SMTP send failed:", emailErr.message);
    const msg = emailErr.message.includes("Email not configured")
      ? "Email service is not configured on the server. Contact admin."
      : emailErr.message.includes("Invalid login") || emailErr.message.includes("auth")
        ? "Email authentication failed. Check SMTP_* or EMAIL_USER/EMAIL_PASS."
        : "Failed to send OTP. Please try again.";
    throw new AppError(msg, 503);
  }

  res.status(200).json({ message: "OTP sent to player's email successfully" });
});

// ────────────────────────────────────────────────────
//  Verify OTP for Player Creation
// ────────────────────────────────────────────────────
// @desc    Verify OTP before allowing player profile creation
// @route   POST /api/otp/verify-player-otp
// @access  Private / Super Admin
const verifyPlayerOtp = catchAsync(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new AppError("Email and OTP are required", 400);
  }

  const record = await Otp.findOne({
    email,
    otp,
    purpose: "player-creation",
  });

  if (!record || record.expiresAt < new Date()) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  record.verified = true;
  await record.save();

  res.status(200).json({ message: "OTP verified successfully", verified: true });
});

// ────────────────────────────────────────────────────
//  Send OTP for Change Password
// ────────────────────────────────────────────────────
// @desc    Send OTP to admin's email before changing password
// @route   POST /api/otp/send-password-otp
// @access  Private
const sendPasswordOtp = catchAsync(async (req, res) => {
  const admin = await Admin.findById(req.admin._id);
  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  await Otp.deleteMany({ email: admin.email, purpose: "change-password" });

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await Otp.create({
    email: admin.email,
    otp,
    purpose: "change-password",
    expiresAt,
  });

  try {
    await sendOTPEmail(admin.email, otp, "change-password");
  } catch (emailErr) {
    console.error("SMTP send failed:", emailErr.message);
    const msg = emailErr.message.includes("Email not configured")
      ? "Email service is not configured on the server. Contact admin."
      : emailErr.message.includes("Invalid login") || emailErr.message.includes("auth")
        ? "Email authentication failed. Check SMTP_* or EMAIL_USER/EMAIL_PASS."
        : "Failed to send OTP. Please try again.";
    throw new AppError(msg, 503);
  }

  res.status(200).json({ message: "OTP sent to your email successfully" });
});

// ────────────────────────────────────────────────────
//  Verify OTP for Change Password
// ────────────────────────────────────────────────────
// @desc    Verify OTP before allowing password change
// @route   POST /api/otp/verify-password-otp
// @access  Private
const verifyPasswordOtp = catchAsync(async (req, res) => {
  const admin = await Admin.findById(req.admin._id);
  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  const { otp } = req.body;

  if (!otp) {
    throw new AppError("OTP is required", 400);
  }

  const record = await Otp.findOne({
    email: admin.email,
    otp,
    purpose: "change-password",
  });

  if (!record || record.expiresAt < new Date()) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  record.verified = true;
  await record.save();

  res.status(200).json({ message: "OTP verified successfully", verified: true });
});

module.exports = {
  sendPlayerOtp,
  verifyPlayerOtp,
  sendPasswordOtp,
  verifyPasswordOtp,
};
