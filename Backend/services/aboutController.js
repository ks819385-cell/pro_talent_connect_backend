const About = require("../Models/About");
const { logAction } = require("../Middleware/auditLogger");
const { AppError, catchAsync } = require("../Middleware/errorHandler");

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
  updateAbout,
  uploadImages,
};
