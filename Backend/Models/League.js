const mongoose = require("mongoose");

const leagueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    tier: {
      type: String,
      required: true,
      enum: ["Tier 1", "Tier 2", "Tier 3", "Tier 4", "State Tier"],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

leagueSchema.index({ tier: 1, name: 1 });

module.exports = mongoose.model("League", leagueSchema);
