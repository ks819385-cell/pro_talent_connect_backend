const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    excerpt: {
      type: String,
      maxlength: 300,
      trim: true,
    },
    author: {
      type: String,
      trim: true,
    },
    author_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    category: {
      type: String,
      enum: ["Transfers", "Achievements", "Announcements", "News", "General"],
      default: "General",
    },
    image: {
      type: String,
      default: "",
    },
    cover_image: {
      type: String,
      default: "",
    },
    readTime: {
      type: Number,
      default: 5,
    },
    tags: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      default: "DRAFT",
    },
    published_at: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // Automatically creates createdAt and updatedAt
  }
);

// Auto-generate slug from title before saving
blogSchema.pre("save", function () {
  if (this.isModified("title") && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
});

// Auto-set published_at when status changes to PUBLISHED
blogSchema.pre("save", function () {
  if (this.isModified("status") && this.status === "PUBLISHED" && !this.published_at) {
    this.published_at = new Date();
  }
});

module.exports = mongoose.model("Blog", blogSchema);
