const Player = require("../Models/Players");
const { logAction } = require("../Middleware/auditLogger");
const { calculateScoutReport } = require("./scoutReportCalculator");
const { AppError, catchAsync } = require("../Middleware/errorHandler");

// @desc    Create a new player
// @route   POST /api/players
// @access  Private / Super Admin Only
const createPlayer = catchAsync(async (req, res) => {
    // Only Super Admin can create players
    if (req.user.role !== "Super Admin") {
      throw new AppError("Access denied. Only Super Admin can create players.", 403);
    }

    const {
      name,
      age,
      age_group,
      playingPosition,
      alternativePosition,
      preferredFoot,
      transferMarketLink,
      playerId,
      dateOfBirth,
      nationality,
      weight,
      height,
      gender,
      jersey_no,
      size,
      state,
      address,
      mobileNumber,
      email,
      profileImage,
      scouting_notes,
      career_history,
      media_links,
      youtubeVideoUrl,
      videoThumbnail,
      videoTitle,
      videoDescription,
      clubsPlayed,
      plId,
      competitions,
      currentLeague,
      stateLeague,
      clubTier,
      sprint30m,
      sprint50m,
      mentalityScore,
    } = req.body;

    // Check required fields
    if (
      !name ||
      !playingPosition ||
      !playerId ||
      !dateOfBirth ||
      !gender ||
      !mobileNumber ||
      !email
    ) {
      throw new AppError("Please provide all required fields", 400);
    }

    // Auto-calculate age from dateOfBirth if not provided
    let calculatedAge = age;
    if (!calculatedAge && dateOfBirth) {
      const dob = new Date(dateOfBirth);
      const today = new Date();
      calculatedAge = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate()))
        calculatedAge--;
    }

    // Check for duplicate playerId or email (only among non-deleted players)
    const existingPlayer = await Player.findOne({
      $or: [{ playerId }, { email }],
      isDeleted: { $ne: true },
    });

    if (existingPlayer) {
      throw new AppError("Duplicate playerId or email", 400);
    }

    // Build player data and auto-calculate Scout Report
    const playerData = {
      name,
      age: calculatedAge,
      age_group,
      playingPosition,
      alternativePosition,
      preferredFoot,
      transferMarketLink,
      playerId,
      dateOfBirth,
      nationality,
      weight,
      height,
      gender,
      jersey_no,
      size,
      state,
      address,
      mobileNumber,
      email,
      profileImage,
      scouting_notes,
      career_history,
      media_links,
      youtubeVideoUrl,
      videoThumbnail,
      videoTitle,
      videoDescription,
      clubsPlayed,
      plId,
      competitions,
      currentLeague,
      stateLeague,
      clubTier,
      sprint30m,
      sprint50m,
      mentalityScore,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    };

    // Auto-calculate scout report scores
    try {
      playerData.scoutReport = calculateScoutReport({
        age,
        height,
        weight,
        playingPosition,
        transferMarketLink,
        competitions,
        currentLeague,
        stateLeague,
        clubTier,
        clubsPlayed,
        sprint30m,
        mentalityScore,
      });
    } catch (error) {
      console.error("Error calculating scout report:", error);
      // Don't fail the creation if score calculation fails
      playerData.scoutReport = {
        ageScore: 0,
        physicalScore: 0,
        transferMarketScore: 0,
        competitionScore: 0,
        championshipBonus: 0,
        stateLeagueBonus: 0,
        clubReputationBonus: 0,
        speedScore: 0,
        mentalityAssessment: 0,
        totalScore: 0,
        grade: "",
      };
    }

    const player = await Player.create(playerData);

    // Populate admin details before returning
    await player.populate({
      path: "createdBy",
      select: "name email role",
      strictPopulate: false,
    });
    await player.populate({
      path: "updatedBy",
      select: "name email role",
      strictPopulate: false,
    });

    // Log player creation
    await logAction({
      user: req.user,
      action: "CREATE",
      resourceType: "Player",
      resourceId: player._id.toString(),
      description: `Player created: ${player.name} (ID: ${player.playerId})`,
      req,
      changes: { name, playerId, playingPosition, email },
      status: "SUCCESS",
    });

    res.status(201).json(player);
});

// @desc    Get all players (with optional filters & pagination)
// @route   GET /api/players
// @access  Private / Admin & Super Admin
const getAllPlayers = catchAsync(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter from query params (exclude soft-deleted)
    const filter = { isDeleted: { $ne: true } };
    if (req.query.name) {
      filter.name = { $regex: req.query.name, $options: "i" };
    }
    if (req.query.playingPosition) {
      filter.playingPosition = {
        $regex: req.query.playingPosition,
        $options: "i",
      };
    }
    if (req.query.gender) {
      filter.gender = req.query.gender;
    }
    if (req.query.age_group) {
      filter.age_group = req.query.age_group;
    }
    if (req.query.preferredFoot) {
      filter.preferredFoot = req.query.preferredFoot;
    }

    const totalResults = await Player.countDocuments(filter);
    const totalPages = Math.ceil(totalResults / limit);
    const players = await Player.find(filter)
      .populate({
        path: "createdBy",
        select: "name email role",
        strictPopulate: false,
      })
      .populate({
        path: "updatedBy",
        select: "name email role",
        strictPopulate: false,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      players,
      currentPage: page,
      totalPages,
      totalResults,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
});

// @desc    Search players by multiple criteria
// @route   GET /api/players/search
// @access  Private / Admin & Super Admin
const searchPlayers = catchAsync(async (req, res) => {
    const { name, state, age_group, position, gender } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build dynamic search query
    const filter = { isDeleted: { $ne: true } };
    const orConditions = [];

    if (name) {
      orConditions.push({ name: { $regex: name, $options: "i" } });
    }
    if (state) {
      orConditions.push({ state: { $regex: state, $options: "i" } });
    }
    if (position) {
      orConditions.push(
        { playingPosition: { $regex: position, $options: "i" } },
        { alternativePosition: { $regex: position, $options: "i" } },
      );
    }

    // Exact match filters
    if (age_group) {
      filter.age_group = age_group;
    }
    if (gender) {
      filter.gender = gender;
    }

    // Combine OR conditions if any exist
    if (orConditions.length > 0) {
      filter.$or = orConditions;
    }

    // If no search criteria provided
    if (!name && !state && !age_group && !position && !gender) {
      throw new AppError("Please provide at least one search parameter: name, state, age_group, position, or gender", 400);
    }

    const totalResults = await Player.countDocuments(filter);
    const totalPages = Math.ceil(totalResults / limit);
    const players = await Player.find(filter)
      .populate({
        path: "createdBy",
        select: "name email role",
        strictPopulate: false,
      })
      .populate({
        path: "updatedBy",
        select: "name email role",
        strictPopulate: false,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: players.length,
      totalResults,
      totalPages,
      currentPage: page,
      players,
    });
});

// @desc    Get single player by ID
// @route   GET /api/players/:id
// @access  Private / Admin & Super Admin
const getPlayerById = catchAsync(async (req, res) => {
    const player = await Player.findOne({
      _id: req.params.id,
      isDeleted: { $ne: true },
    })
      .populate({
        path: "createdBy",
        select: "name email role",
        strictPopulate: false,
      })
      .populate({
        path: "updatedBy",
        select: "name email role",
        strictPopulate: false,
      });

    if (!player) {
      throw new AppError("Player not found", 404);
    }

    res.status(200).json(player);
});

// @desc    Update a player
// @route   PUT /api/players/:id
// @access  Private / Admin & Super Admin
const updatePlayer = catchAsync(async (req, res) => {
    const player = await Player.findOne({
      _id: req.params.id,
      isDeleted: { $ne: true },
    });

    if (!player) {
      throw new AppError("Player not found", 404);
    }

    // Update only provided fields
    const updatableFields = [
      "name",
      "age",
      "age_group",
      "playingPosition",
      "alternativePosition",
      "preferredFoot",
      "transferMarketLink",
      "playerId",
      "dateOfBirth",
      "nationality",
      "weight",
      "height",
      "gender",
      "jersey_no",
      "size",
      "state",
      "address",
      "mobileNumber",
      "email",
      "profileImage",
      "scouting_notes",
      "career_history",
      "media_links",
      "youtubeVideoUrl",
      "videoThumbnail",
      "videoTitle",
      "videoDescription",
      "clubsPlayed",
      "plId",
      "competitions",
      "currentLeague",
      "stateLeague",
      "clubTier",
      "sprint30m",
      "sprint50m",
      "mentalityScore",
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        player[field] = req.body[field];
      }
    });

    // Track who updated
    player.updatedBy = req.user._id;

    // Auto-recalculate scout report on every update
    try {
      player.scoutReport = calculateScoutReport({
        age: player.age,
        height: player.height,
        weight: player.weight,
        playingPosition: player.playingPosition,
        transferMarketLink: player.transferMarketLink,
        competitions: player.competitions,
        currentLeague: player.currentLeague,
        stateLeague: player.stateLeague,
        clubTier: player.clubTier,
        clubsPlayed: player.clubsPlayed,
        sprint30m: player.sprint30m,
        mentalityScore: player.mentalityScore,
      });
    } catch (error) {
      console.error("Error calculating scout report:", error);
      // Don't fail the update if score calculation fails
    }

    const updatedPlayer = await player.save();
    await updatedPlayer.populate({
      path: "createdBy",
      select: "name email role",
      strictPopulate: false,
    });
    await updatedPlayer.populate({
      path: "updatedBy",
      select: "name email role",
      strictPopulate: false,
    });

    // Log player update
    await logAction({
      user: req.user,
      action: "UPDATE",
      resourceType: "Player",
      resourceId: player._id.toString(),
      description: `Player updated: ${updatedPlayer.name} (ID: ${updatedPlayer.playerId})`,
      req,
      changes: req.body,
      status: "SUCCESS",
    });

    res.status(200).json(updatedPlayer);
});

// @desc    Delete a player
// @route   DELETE /api/players/:id
// @access  Private / Admin & Super Admin
const deletePlayer = catchAsync(async (req, res) => {
    const player = await Player.findById(req.params.id);

    if (!player) {
      throw new AppError("Player not found", 404);
    }

    // Hard delete — permanently remove from database
    await Player.deleteOne({ _id: player._id });

    // Log player deletion
    await logAction({
      user: req.user,
      action: "DELETE",
      resourceType: "Player",
      resourceId: player._id.toString(),
      description: `Player deleted: ${player.name} (ID: ${player.playerId})`,
      req,
      changes: { deleted: true },
      status: "SUCCESS",
    });

    res.status(200).json({ message: "Player deleted successfully" });
});

module.exports = {
  createPlayer,
  getAllPlayers,
  searchPlayers,
  getPlayerById,
  updatePlayer,
  deletePlayer,
};
