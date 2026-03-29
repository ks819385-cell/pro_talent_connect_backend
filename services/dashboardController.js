const Player = require("../Models/Players");
const Admin = require("../Models/Admin");
const { catchAsync } = require("../Middleware/errorHandler");

// @desc    Get dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private / Admin & Super Admin
const getDashboardStats = catchAsync(async (req, res) => {
  const [totalPlayers, totalAdmins, activePlayers, deletedPlayers] =
    await Promise.all([
      Player.countDocuments(),
      Admin.countDocuments(),
      Player.countDocuments({ isDeleted: false }),
      Player.countDocuments({ isDeleted: true }),
    ]);

  res.status(200).json({
    totalPlayers,
    totalAdmins,
    activePlayers,
    deletedPlayers,
  });
});

module.exports = { getDashboardStats };
