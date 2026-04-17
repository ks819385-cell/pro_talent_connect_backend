const About = require("../Models/About");
const mongoose = require("mongoose");
const { logAction } = require("../Middleware/auditLogger");
const { AppError, catchAsync } = require("../Middleware/errorHandler");

const PARTNER_SOCIAL_PLATFORMS = [
  "instagram",
  "twitter",
  "linkedin",
  "facebook",
  "youtube",
  "website",
];

const toTrimmedString = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizePartnerSocial = (social = {}) => {
  const normalized = {};

  PARTNER_SOCIAL_PLATFORMS.forEach((platform) => {
    const handle = toTrimmedString(social?.[platform]?.handle);
    const url = toTrimmedString(social?.[platform]?.url);

    if (handle || url) {
      normalized[platform] = { handle, url };
    }
  });

  return normalized;
};

const normalizePartners = (partners = []) =>
  partners.map((partner) => ({
    id: toTrimmedString(partner?.id) || new mongoose.Types.ObjectId().toString(),
    name: toTrimmedString(partner?.name),
    type: toTrimmedString(partner?.type),
    description: toTrimmedString(partner?.description),
    avatar: toTrimmedString(partner?.avatar),
    logoUrl: toTrimmedString(partner?.logoUrl),
    avatarColor:
      toTrimmedString(partner?.avatarColor) || "from-red-500/30 to-red-900/30",
    borderColor: toTrimmedString(partner?.borderColor) || "border-red-500/20",
    accentColor: toTrimmedString(partner?.accentColor) || "text-red-400",
    social: normalizePartnerSocial(partner?.social),
  }));

// @desc    Get organisation profile
// @route   GET /api/about
// @access  Public
const getAbout = catchAsync(async (req, res) => {
  const about = await About.getSingleton();

  res.status(200).json({
    success: true,
    about,
  });
});

// @desc    Get partners and collaborators list
// @route   GET /api/about/partners
// @access  Public
const getPartners = catchAsync(async (req, res) => {
  const about = await About.getSingleton();

  res.status(200).json({
    success: true,
    partners: about.partners || [],
  });
});

// @desc    Update organisation profile
// @route   PUT /api/about
// @access  Private / Super Admin only
const updateAbout = catchAsync(async (req, res) => {
  const about = await About.getSingleton();

  const updatableFields = [
    "org_name",
    "mission",
    "history",
    "credentials",
    "contact_email",
    "contact_phone",
    "location",
    "images",
    "pro_talent_plus",
    "social_links",
    "partners",
  ];

  updatableFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      about[field] = req.body[field];
      // Mongoose won't auto-detect nested object mutations — mark them explicitly
      about.markModified(field);
    }
  });

  const updatedAbout = await about.save();

  await logAction({
    user: req.user || req.admin,
    action: "UPDATE",
    resourceType: "About",
    resourceId: updatedAbout._id.toString(),
    description: `Organisation profile updated`,
    req,
    changes: req.body,
    status: "SUCCESS"
  });

  res.status(200).json({
    success: true,
    message: "Organisation profile updated successfully",
    about: updatedAbout,
  });
});

// @desc    Replace full partners and collaborators list
// @route   PUT /api/about/partners
// @access  Private / Super Admin only
const updatePartners = catchAsync(async (req, res) => {
  const { partners } = req.body;

  if (!Array.isArray(partners)) {
    throw new AppError("Partners must be provided as an array", 400);
  }

  const normalizedPartners = normalizePartners(partners);
  const hasMissingRequiredFields = normalizedPartners.some(
    (partner) => !partner.name || !partner.type || !partner.description,
  );

  if (hasMissingRequiredFields) {
    throw new AppError(
      "Each partner requires name, type, and description",
      400,
    );
  }

  const about = await About.getSingleton();
  about.partners = normalizedPartners;
  about.markModified("partners");

  const updatedAbout = await about.save();

  await logAction({
    user: req.user || req.admin,
    action: "UPDATE",
    resourceType: "About",
    resourceId: updatedAbout._id.toString(),
    description: `Updated partners list (${updatedAbout.partners.length} item(s))`,
    req,
    changes: { partners: updatedAbout.partners },
    status: "SUCCESS",
  });

  res.status(200).json({
    success: true,
    message: "Partners updated successfully",
    partners: updatedAbout.partners,
  });
});

// @desc    Upload/Add new gallery images
// @route   POST /api/about/images
// @access  Private / Super Admin only
const uploadImages = catchAsync(async (req, res) => {
  const { images } = req.body;

  if (!images || !Array.isArray(images) || images.length === 0) {
    throw new AppError("Please provide an array of image URLs", 400);
  }

  const about = await About.getSingleton();

  images.forEach((imageUrl) => {
    if (!about.images.includes(imageUrl)) {
      about.images.push(imageUrl);
    }
  });

  const updatedAbout = await about.save();

  await logAction({
    user: req.user || req.admin,
    action: "UPDATE",
    resourceType: "About",
    resourceId: updatedAbout._id.toString(),
    description: `Added ${images.length} image(s) to organisation gallery`,
    req,
    changes: { images_added: images },
    status: "SUCCESS"
  });

  res.status(200).json({
    success: true,
    message: `${images.length} image(s) added to gallery`,
    about: updatedAbout,
  });
});

module.exports = {
  getAbout,
  getPartners,
  updateAbout,
  updatePartners,
  uploadImages,
};
