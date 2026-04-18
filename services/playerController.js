const Player = require("../Models/Players");
const { logAction } = require("../Middleware/auditLogger");
const { calculateScoutReport } = require("./scoutReportCalculator");
const { AppError, catchAsync } = require("../Middleware/errorHandler");

const MISSING_ID_LABEL = "Player Has No ID";

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseNumericFilter(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPlayerFilter(query, { requireSearch = false } = {}) {
  const filter = { isDeleted: { $ne: true } };
  const orConditions = [];

  const searchQuery = query.searchQuery?.trim() || query.q?.trim() || "";
  if (searchQuery) {
    const escaped = escapeRegex(searchQuery);
    orConditions.push(
      { name: { $regex: escaped, $options: "i" } },
      { playingPosition: { $regex: escaped, $options: "i" } },
      { alternativePosition: { $regex: escaped, $options: "i" } },
      { state: { $regex: escaped, $options: "i" } },
      { nationality: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
      { playerId: { $regex: escaped, $options: "i" } },
    );
  }

  const position = query.position?.trim() || query.playingPosition?.trim() || "";
  if (position) {
    const escaped = escapeRegex(position);
    orConditions.push(
      { playingPosition: { $regex: escaped, $options: "i" } },
      { alternativePosition: { $regex: escaped, $options: "i" } },
    );
  }

  const state = query.state?.trim() || "";
  if (state) {
    filter.state = { $regex: escapeRegex(state), $options: "i" };
  }

  if (query.gender) {
    filter.gender = query.gender;
  }

  if (query.age_group) {
    filter.age_group = query.age_group;
  }

  if (query.preferredFoot) {
    filter.preferredFoot = query.preferredFoot;
  }

  const ageMin = parseNumericFilter(query.ageMin);
  const ageMax = parseNumericFilter(query.ageMax);
  if (ageMin !== null || ageMax !== null) {
    filter.age = {};
    if (ageMin !== null) filter.age.$gte = ageMin;
    if (ageMax !== null) filter.age.$lte = ageMax;
  }

  const heightMin = parseNumericFilter(query.heightMin);
  const heightMax = parseNumericFilter(query.heightMax);
  if (heightMin !== null || heightMax !== null) {
    filter.height = {};
    if (heightMin !== null) filter.height.$gte = heightMin;
    if (heightMax !== null) filter.height.$lte = heightMax;
  }

  const weightMin = parseNumericFilter(query.weightMin);
  const weightMax = parseNumericFilter(query.weightMax);
  if (weightMin !== null || weightMax !== null) {
    filter.weight = {};
    if (weightMin !== null) filter.weight.$gte = weightMin;
    if (weightMax !== null) filter.weight.$lte = weightMax;
  }

  if (orConditions.length > 0) {
    filter.$or = orConditions;
  }

  const hasAnyCriteria = [
    searchQuery,
    position,
    state,
    query.gender,
    query.age_group,
    query.preferredFoot,
    query.ageMin,
    query.ageMax,
    query.heightMin,
    query.heightMax,
    query.weightMin,
    query.weightMax,
  ].some(Boolean);

  if (requireSearch && !hasAnyCriteria) {
    throw new AppError("Please provide at least one search parameter", 400);
  }

  return filter;
}

function buildPlayerSort(query) {
  const sortBy = (query.sortBy || "createdAt").trim();
  const sortOrder = query.sortOrder === "asc" ? 1 : -1;

  switch (sortBy) {
    case "name":
      return { name: sortOrder, createdAt: -1 };
    case "age":
      return { age: sortOrder, createdAt: -1 };
    case "height":
      return { height: sortOrder, createdAt: -1 };
    case "score":
      return { "scoutReport.totalScore": sortOrder, createdAt: -1 };
    case "position":
      return { playingPosition: sortOrder, name: 1 };
    case "createdAt":
    default:
      return { createdAt: -1 };
  }
}

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
      competitions,
      currentLeague,
      stateLeague,
      clubTier,
      sprint30m,
      sprint50m,
      mentalityScore,
    } = req.body;

    const normalizedPlayerId = playerId?.trim() || MISSING_ID_LABEL;

    // Check required fields
    if (
      !name ||
      !playingPosition ||
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

    // Check for duplicate playerId or email (only among non-deleted players).
    // The missing-ID placeholder is intentionally reusable.
    const playerIdFilter = normalizedPlayerId === MISSING_ID_LABEL ? null : { playerId: normalizedPlayerId };
    const existingPlayer = await Player.findOne({
      $or: [playerIdFilter, { email }].filter(Boolean),
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
      playerId: normalizedPlayerId,
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
      plId: normalizedPlayerId,
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
      changes: { name, playerId: normalizedPlayerId, playingPosition, email },
      status: "SUCCESS",
    });

    res.status(201).json(player);
});

// @desc    Get all players (with optional filters & pagination)
// @route   GET /api/players
// @access  Private / Admin & Super Admin
const getAllPlayers = catchAsync(async (req, res) => {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const filter = buildPlayerFilter(req.query);
    const sort = buildPlayerSort(req.query);

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
      .sort(sort)
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
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const filter = buildPlayerFilter(req.query, { requireSearch: true });
    const sort = buildPlayerSort(req.query);

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
      .sort(sort)
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

    player.plId = player.playerId;

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
