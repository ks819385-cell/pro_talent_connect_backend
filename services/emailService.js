/**
 * Email Utility Service
 * Handles sending OTP emails via Nodemailer
 *
 * - If SMTP_* is set → uses the configured SMTP server
 * - Else if EMAIL_USER & EMAIL_PASS are set → uses Gmail (or configured service)
 * - Otherwise → auto-creates a free Ethereal test account (no config needed)
 *   and logs a preview URL to the terminal so you can view the email.
 */

const nodemailer = require("nodemailer");

// Cached Ethereal transporter so we only create one test account per server run
let _etherealTransporter = null;

/**
 * Check whether real email credentials are configured
 */
const hasSmtpCredentials = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  return Boolean(host && user && pass);
};

const hasLegacyCredentials = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  return (
    user &&
    pass &&
    user !== "your-email@gmail.com" &&
    pass !== "your-app-password"
  );
};

const hasRealCredentials = () => hasSmtpCredentials() || hasLegacyCredentials();

/** Wrap a promise with a timeout — rejects with a descriptive error if it hangs */
const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);

const getTransporter = async () => {
  // ── Real credentials configured ──
  if (hasSmtpCredentials()) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT == 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    return transporter;
  }

  if (hasLegacyCredentials()) {
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      pool: true,
      maxConnections: 3,
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
    return transporter;
  }

  // ── No credentials → Ethereal (free test account, zero config) ──
  if (_etherealTransporter) return _etherealTransporter;

  // Guard: Ethereal account creation can hang for >30 s on slow networks
  const testAccount = await withTimeout(
    nodemailer.createTestAccount(),
    15000,
    "Ethereal test-account creation"
  );

  _etherealTransporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });

  console.log("─────────────────────────────────────────────");
  console.log("📧  Using Ethereal test email (no credentials configured)");
  console.log(`    Account: ${testAccount.user}`);
  console.log("    Emails won't reach real inboxes but preview URLs are logged.");
  console.log("    To use real SMTP, set SMTP_HOST/SMTP_USER/SMTP_PASSWORD in .env");
  console.log("    Or use Gmail by setting EMAIL_USER & EMAIL_PASS in .env");
  console.log("─────────────────────────────────────────────");

  return _etherealTransporter;
};

/**
 * Generate a 6-digit numeric OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP email
 * @param {string} to - Recipient email
 * @param {string} otp - The OTP code
 * @param {string} purpose - "player-creation" or "change-password"
 */
const sendOTPEmail = async (to, otp, purpose) => {
  const transporter = await getTransporter();

  const purposeMap = {
    "player-creation": "Player Profile Creation",
    "change-password": "Password Change Verification",
    "forgot-password": "Password Reset Verification",
  };
  const purposeText = purposeMap[purpose] || "Verification";

  const fallbackFrom = hasSmtpCredentials()
    ? process.env.SMTP_USER
    : hasLegacyCredentials()
      ? process.env.EMAIL_USER
      : "otp@protalent.dev";
  const fromAddr = process.env.EMAIL_FROM || `"ProTalent Connect" <${fallbackFrom}>`;

  const mailOptions = {
    from: fromAddr,
    to,
    subject: `Your OTP for ${purposeText} - ProTalent Connect`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f9fafb; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background: linear-gradient(135deg, #dc2626, #991b1b); padding: 28px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">ProTalent Connect</h1>
        </div>
        <div style="padding: 32px 24px;">
          <h2 style="color: #111827; font-size: 18px; margin: 0 0 8px; font-weight: 600;">${purposeText}</h2>
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px; line-height: 1.5;">
            Use the following OTP to complete your ${purposeText.toLowerCase()}. This code is valid for <strong>10 minutes</strong>.
          </p>
          <div style="background: #111827; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #f87171; font-family: 'Courier New', monospace;">${otp}</span>
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.5;">
            If you did not request this code, please ignore this email. Do not share this OTP with anyone.
          </p>
        </div>
        <div style="background: #f3f4f6; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">&copy; ${new Date().getFullYear()} ProTalent Connect. All rights reserved.</p>
        </div>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);

  // Log OTP and preview URL to terminal (always helpful during development)
  console.log(`\n🔑  OTP for ${to} [${purpose}]: ${otp}`);

  // Ethereal provides a preview URL to view the email in browser
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`📨  Preview email → ${previewUrl}\n`);
  }
};

module.exports = { generateOTP, sendOTPEmail };
