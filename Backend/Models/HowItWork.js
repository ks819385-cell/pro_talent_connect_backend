const mongoose = require("mongoose");

const howItWorkSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    stepNumber: {
      type: Number,
      required: true,
    },
    icon: {
      type: String,
      required: true,
      enum: [
        'UserPlusIcon',
        'CheckBadgeIcon',
        'MagnifyingGlassIcon',
        'RocketLaunchIcon',
        'other'
      ],
      default: 'other'
    },
    customIcon: {
      type: String,
    },
    color: {
      type: String,
      default: 'red',
      enum: ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'orange']
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
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
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
howItWorkSchema.index({ order: 1, stepNumber: 1, isActive: 1 });

module.exports = mongoose.model("HowItWork", howItWorkSchema);
