const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
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
    icon: {
      type: String,
      required: true,
      enum: [
        'MagnifyingGlassIcon',
        'UserCircleIcon',
        'TrophyIcon',
        'ShieldCheckIcon',
        'LifebuoyIcon',
        'ChartBarIcon',
        'other'
      ],
      default: 'other'
    },
    customIcon: {
      type: String, // For custom icon names not in enum
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
serviceSchema.index({ order: 1, isActive: 1 });

module.exports = mongoose.model("Service", serviceSchema);
