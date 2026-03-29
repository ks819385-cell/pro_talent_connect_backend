const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      min: 5,
      max: 100,
    },
    age_group: {
      type: String,
      enum: ["U13", "U15", "U17", "U19", "Senior"],
    },
    playingPosition: {
      type: String,
      required: true,
    },
    alternativePosition: {
      type: String,
    },
    preferredFoot: {
      type: String,
      enum: ["Left", "Right", "Both"],
    },
    transferMarketLink: {
      type: String,
      trim: true,
    },
    playerId: {
      type: String,
      required: true,
      unique: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    nationality: {
      type: String,
      trim: true,
    },
    weight: {
      type: Number, // in kg
    },
    height: {
      type: Number, // in cm
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      required: true,
    },
    jersey_no: {
      type: Number,
      min: 0,
      max: 99,
    },
    size: {
      type: String,
      enum: ["XS", "S", "M", "L", "XL", "XXL"],
    },
    state: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    profileImage: {
      type: String,
      default: "",
    },
    scouting_notes: {
      type: String,
      default: "",
    },
    career_history: {
      type: String,
      default: "",
    },
    media_links: {
      type: [String],
      default: [],
    },
    youtubeVideoUrl: {
      type: String,
      trim: true,
      default: "",
    },
    videoThumbnail: {
      type: String,
      trim: true,
      default: "",
    },
    videoTitle: {
      type: String,
      trim: true,
      default: "",
    },
    videoDescription: {
      type: String,
      trim: true,
      default: "",
    },

    // ─── Scout Friendly Report™ Fields ───
    // CRS / PL ID for AIFF verification
    plId: {
      type: String,
      trim: true,
      default: "",
    },

    // Competition history entries
    competitions: [
      {
        name: { type: String, required: true },
        type: { type: String, trim: true, default: "" },
        year: { type: Number },
        result: {
          type: String,
          enum: ["Champion", "Runner-up", "Third", "Participant", ""],
          default: "",
        },
      },
    ],

    // Current league the player is active in
    currentLeague: {
      type: String,
      trim: true,
      default: "",
    },

    // State league recognition (free-form to support dynamic league management)
    stateLeague: {
      type: String,
      trim: true,
      default: "",
    },

    // Club tier for reputation bonus
    clubTier: {
      type: String,
      enum: ["", "Tier 1", "Tier 2", "Tier 3"],
      default: "",
    },

    // Speed metrics
    sprint30m: {
      type: Number, // seconds
      min: 0,
    },
    sprint50m: {
      type: Number, // seconds
      min: 0,
    },

    // Mentality assessment score (0 = no data, 1 or 2)
    mentalityScore: {
      type: Number,
      enum: [0, 1, 2],
      default: 0,
    },

    // Computed Scout Friendly Report™ scores (auto-calculated)
    scoutReport: {
      ageScore: { type: Number, default: 0 },
      physicalScore: { type: Number, default: 0 },
      transferMarketScore: { type: Number, default: 0 },
      competitionScore: { type: Number, default: 0 },
      championshipBonus: { type: Number, default: 0 },
      stateLeagueBonus: { type: Number, default: 0 },
      clubReputationBonus: { type: Number, default: 0 },
      speedScore: { type: Number, default: 0 },
      mentalityAssessment: { type: Number, default: 0 },
      totalScore: { type: Number, default: 0, max: 100 },
      grade: {
        type: String,
        enum: ["A", "B", "C", "D", "E", "N/A", "INCOMPLETE", ""],
        default: "N/A",
      },
    },
    clubsPlayed: [
      {
        clubName: {
          type: String,
          required: true,
        },
        clubLogo: {
          type: String,
          default: "",
        },
        duration: {
          type: String,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    featured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for faster queries (email and playerId already indexed by unique: true)
playerSchema.index({ isDeleted: 1 });
playerSchema.index({ playingPosition: 1 });
playerSchema.index({ age_group: 1 });
playerSchema.index({ gender: 1 });
playerSchema.index({ featured: 1 });
playerSchema.index({ name: 'text', state: 'text', nationality: 'text' }); // Text search

module.exports = mongoose.model("Player", playerSchema);
