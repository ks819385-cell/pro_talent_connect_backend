const mongoose = require("mongoose");

const aboutSchema = new mongoose.Schema(
  {
    org_name: {
      type: String,
      required: [true, "Organisation name is required"],
      trim: true,
    },
    mission: {
      type: String,
      trim: true,
    },
    history: {
      type: String,
      trim: true,
    },
    credentials: {
      type: String,
      trim: true,
    },
    contact_email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
    },
    contact_phone: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
    pro_talent_plus: {
      title: {
        type: String,
        trim: true,
        default: "Pro Talent Connect Plus",
      },
      description: {
        type: String,
        trim: true,
        default: "",
      },
      logo_url: {
        type: String,
        trim: true,
        default: "",
      },
    },
    social_links: {
      instagram: {
        type: String,
        trim: true,
      },
      facebook: {
        type: String,
        trim: true,
      },
      twitter: {
        type: String,
        trim: true,
      },
      youtube: {
        type: String,
        trim: true,
      },
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Ensure only one document exists (singleton pattern)
aboutSchema.statics.getSingleton = async function () {
  let about = await this.findOne();
  if (!about) {
    // Create default document if none exists
    about = await this.create({
      org_name: "Pro-Talent Connect",
      mission: "Discover and connect with the best football talents worldwide.",
      history: "",
      credentials: "",
      contact_email: "info@protalent.com",
      contact_phone: "",
      location: "",
      images: [],
      pro_talent_plus: {
        title: "Pro Talent Connect Plus",
        description: "",
        logo_url: "",
      },
      social_links: {},
    });
  }
  return about;
};

// Prevent multiple documents
aboutSchema.pre("save", async function () {
  const docCount = await this.constructor.countDocuments();
  if (docCount > 0 && this.isNew) {
    throw new Error("Only one About document can exist. Use update instead.");
  }
});

module.exports = mongoose.model("About", aboutSchema);
