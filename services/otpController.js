const Otp = require("../Models/Otp");
const Admin = require("../Models/Admin");
const bcrypt = require("bcryptjs");
const { generateOTP, sendOTPEmail } = require("./emailService");
const { AppError, catchAsync } = require("../Middleware/errorHandler");

const OTP_EXPIRY_MINUTES = 10;

const hashOtp = async (otp) => bcrypt.hash(otp, 10);

const matchesOtp = async (plainOtp, storedValue) => {
  if (!storedValue) return false;
  if (storedValue.startsWith("$2a$") || storedValue.startsWith("$2b$") || storedValue.startsWith("$2y$")) {
    return bcrypt.compare(plainOtp, storedValue);
  }
  return plainOtp === storedValue;
};

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
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await Otp.create({ email, otp: otpHash, purpose: "player-creation", expiresAt });

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
    purpose: "player-creation",
  });

  const isOtpValid = record && await matchesOtp(otp, record.otp);
  if (!record || !isOtpValid || record.expiresAt < new Date()) {
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
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await Otp.create({
    email: admin.email,
    otp: otpHash,
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
//  Send OTP for Forgot Password (Public)
// ────────────────────────────────────────────────────
// @desc    Send OTP to admin email for forgot-password flow
// @route   POST /api/otp/send-forgot-password-otp
// @access  Public
const sendForgotPasswordOtp = catchAsync(async (req, res) => {
  const email = req.body?.email?.trim()?.toLowerCase();

  if (!email) {
    throw new AppError("Email is required", 400);
  }

  await Otp.deleteMany({ email, purpose: "forgot-password" });

  const admin = await Admin.findOne({ email, is_active: true });

  // Return generic success even when account doesn't exist to prevent user enumeration.
  if (!admin) {
    return res.status(200).json({
      message: "If an account exists for this email, an OTP has been sent",
    });
  }

  const otp = generateOTP();
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await Otp.create({
    email,
    otp: otpHash,
    purpose: "forgot-password",
    expiresAt,
  });

  try {
    await sendOTPEmail(email, otp, "forgot-password");
  } catch (emailErr) {
    console.error("SMTP send failed:", emailErr.message);
    const msg = emailErr.message.includes("Email not configured")
      ? "Email service is not configured on the server. Contact admin."
      : emailErr.message.includes("Invalid login") || emailErr.message.includes("auth")
        ? "Email authentication failed. Check SMTP_* or EMAIL_USER/EMAIL_PASS."
        : "Failed to send OTP. Please try again.";
    throw new AppError(msg, 503);
  }

  res.status(200).json({
    message: "If an account exists for this email, an OTP has been sent",
  });
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
    purpose: "change-password",
  });

  const isOtpValid = record && await matchesOtp(otp, record.otp);
  if (!record || !isOtpValid || record.expiresAt < new Date()) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  record.verified = true;
  await record.save();

  res.status(200).json({ message: "OTP verified successfully", verified: true });
});

// ────────────────────────────────────────────────────
//  Verify OTP for Forgot Password (Public)
// ────────────────────────────────────────────────────
// @desc    Verify OTP for forgot-password flow
// @route   POST /api/otp/verify-forgot-password-otp
// @access  Public
const verifyForgotPasswordOtp = catchAsync(async (req, res) => {
  const email = req.body?.email?.trim()?.toLowerCase();
  const otp = req.body?.otp?.trim();

  if (!email || !otp) {
    throw new AppError("Email and OTP are required", 400);
  }

  const record = await Otp.findOne({
    email,
    purpose: "forgot-password",
  });

  const isOtpValid = record && await matchesOtp(otp, record.otp);
  if (!record || !isOtpValid || record.expiresAt < new Date()) {
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
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
};
