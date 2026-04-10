const Player = require("../Models/Players");
const Admin = require("../Models/Admin");
const Blog = require("../Models/Blog");
const Enquiry = require("../Models/Enquiry");
const ProfileRequest = require("../Models/ProfileRequest");
const { catchAsync } = require("../Middleware/errorHandler");

// @desc    Get dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private / Admin & Super Admin
const getDashboardStats = catchAsync(async (req, res) => {
  const [
    totalPlayers,
    totalAdmins,
    activePlayers,
    deletedPlayers,
    totalBlogs,
    publishedBlogs,
    draftBlogs,
    archivedBlogs,
    totalEnquiries,
    pendingEnquiries,
    totalProfileRequests,
    pendingProfileRequests,
  ] =
    await Promise.all([
      Player.countDocuments(),
      Admin.countDocuments(),
      Player.countDocuments({ isDeleted: false }),
      Player.countDocuments({ isDeleted: true }),
      Blog.countDocuments({ isDeleted: false }),
      Blog.countDocuments({ isDeleted: false, status: "PUBLISHED" }),
      Blog.countDocuments({ isDeleted: false, status: "DRAFT" }),
      Blog.countDocuments({ isDeleted: false, status: "ARCHIVED" }),
      Enquiry.countDocuments({ isDeleted: false }),
      Enquiry.countDocuments({ isDeleted: false, status: "pending" }),
      ProfileRequest.countDocuments({ isDeleted: false }),
      ProfileRequest.countDocuments({ isDeleted: false, status: "pending" }),
    ]);

  res.status(200).json({
    totalPlayers,
    totalAdmins,
    activePlayers,
    deletedPlayers,
    totalBlogs,
    publishedBlogs,
    draftBlogs,
    archivedBlogs,
    totalEnquiries,
    pendingEnquiries,
    totalProfileRequests,
    pendingProfileRequests,
  });
});

module.exports = { getDashboardStats };
