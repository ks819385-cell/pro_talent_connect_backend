const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["Admin", "Super Admin"],
      default: "Admin",
    },
    profile_image: {
      type: String,
      default: "",
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    activation_required: {
      type: Boolean,
      default: false,
    },
    is_password_set: {
      type: Boolean,
      default: true,
    },
    invited_at: {
      type: Date,
      default: null,
    },
    activation_completed_at: {
      type: Date,
      default: null,
    },
    last_login: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Validate password strength before saving
adminSchema.pre("validate", function () {
  if (this.isModified("password") && this.password) {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    
    if (!passwordRegex.test(this.password)) {
      this.invalidate(
        "password",
        "Password must be at least 8 characters and contain uppercase, lowercase, number, and special character"
      );
    }
  }
});

// Method to hash password before saving
adminSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  
  // Use 12 rounds for stronger security
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to check password
adminSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

// Add index for faster lookups (email index already created by unique: true)
adminSchema.index({ is_active: 1 });
adminSchema.index({ activation_required: 1 });

module.exports = mongoose.model("Admin", adminSchema);
