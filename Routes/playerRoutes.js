const express = require("express");
const router = express.Router();
const {
  createPlayer,
  getAllPlayers,
  searchPlayers,
  getPlayerById,
  updatePlayer,
  deletePlayer,
} = require("../services/playerController");
const { protect, authorize } = require("../Middleware/authMiddleware");
const { createLimiter } = require("../Middleware/rateLimiter");
const {
  validate,
  createPlayerSchema,
  updatePlayerSchema,
} = require("../Middleware/validator");
const { cacheMiddleware, invalidateCache } = require("../Middleware/cache");

// Public routes - cached for 30s
router.get("/", cacheMiddleware(30, 'players'), getAllPlayers);
router.get("/search", cacheMiddleware(30, 'players'), searchPlayers);
router.get("/:id", cacheMiddleware(60, 'players'), getPlayerById);

// Protected routes - require authentication
router.use(protect);

// Admin & Super Admin can create players (invalidates players cache)
router.post(
  "/",
  authorize("Admin", "Super Admin"),
  createLimiter,
  validate(createPlayerSchema),
  invalidateCache('players'),
  createPlayer
);

// Admin & Super Admin can update players
router.put(
  "/:id",
  authorize("Admin", "Super Admin"),
  validate(updatePlayerSchema),
  invalidateCache('players'),
  updatePlayer
);

// Only Super Admin can delete players
router.delete("/:id", authorize("Super Admin"), invalidateCache('players'), deletePlayer);

module.exports = router;
