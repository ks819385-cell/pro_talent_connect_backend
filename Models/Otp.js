const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    otp: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ["player-creation", "change-password"],
      required: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index — auto-delete when expired
    },
  },
  { timestamps: true }
);

// Compound index for quick lookups
otpSchema.index({ email: 1, purpose: 1 });

module.exports = mongoose.model("Otp", otpSchema);
