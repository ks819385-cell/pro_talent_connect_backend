const mongoose = require("mongoose");

const profileRequestSchema = new mongoose.Schema(
  {
    // Basic Information
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    nationality: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    
    // Career Information
    playingPosition: {
      type: String,
      required: true,
      trim: true,
    },
    preferredFoot: {
      type: String,
      enum: ["Left", "Right", "Both"],
      required: true,
    },
    height: {
      type: Number,
      required: true,
    },
    weight: {
      type: Number,
      required: true,
    },
    currentClub: {
      type: String,
      trim: true,
    },
    yearsOfExperience: {
      type: Number,
      required: true,
    },
    achievements: {
      type: String,
      default: "",
    },
    videoLink: {
      type: String,
      trim: true,
      default: "",
    },
    
    status: {
      type: String,
      enum: ["pending", "reviewing", "approved", "rejected"],
      default: "pending",
    },
    adminNotes: {
      type: String,
      default: "",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ProfileRequest", profileRequestSchema);
