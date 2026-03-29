const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    user_name: {
      type: String,
      required: true,
    },
    user_email: {
      type: String,
      required: true,
    },
    user_role: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "LOGIN",
        "LOGOUT",
        "PASSWORD_CHANGE",
        "ROLE_CHANGE",
      ],
    },
    resource_type: {
      type: String,
      required: true,
      enum: [
        "Admin",
        "Player",
        "Blog",
        "About",
        "Auth",
      ],
    },
    resource_id: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      required: true,
    },
    ip_address: {
      type: String,
      default: null,
    },
    user_agent: {
      type: String,
      default: null,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILURE"],
      default: "SUCCESS",
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Index for faster queries
auditLogSchema.index({ user_id: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resource_type: 1, resource_id: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
