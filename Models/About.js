const mongoose = require("mongoose");

const partnerSocialLinkSchema = new mongoose.Schema(
  {
    handle: {
      type: String,
      trim: true,
      default: "",
    },
    url: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  },
);

const partnerSocialSchema = new mongoose.Schema(
  {
    instagram: { type: partnerSocialLinkSchema, default: () => ({}) },
    twitter: { type: partnerSocialLinkSchema, default: () => ({}) },
    linkedin: { type: partnerSocialLinkSchema, default: () => ({}) },
    facebook: { type: partnerSocialLinkSchema, default: () => ({}) },
    youtube: { type: partnerSocialLinkSchema, default: () => ({}) },
    website: { type: partnerSocialLinkSchema, default: () => ({}) },
  },
  {
    _id: false,
    minimize: false,
  },
);

const partnerSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      trim: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    name: {
      type: String,
      required: [true, "Partner name is required"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Partner type is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Partner description is required"],
      trim: true,
    },
    avatar: {
      type: String,
      trim: true,
      default: "",
    },
    logoUrl: {
      type: String,
      trim: true,
      default: "",
    },
    avatarColor: {
      type: String,
      trim: true,
      default: "from-red-500/30 to-red-900/30",
    },
    borderColor: {
      type: String,
      trim: true,
      default: "border-red-500/20",
    },
    accentColor: {
      type: String,
      trim: true,
      default: "text-red-400",
    },
    social: {
      type: partnerSocialSchema,
      default: () => ({}),
    },
  },
  {
    _id: false,
    minimize: false,
  },
);

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
    partners: {
      type: [partnerSchema],
      default: [],
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
      partners: [],
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
