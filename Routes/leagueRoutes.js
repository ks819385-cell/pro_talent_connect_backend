const express = require("express");
const router = express.Router();
const {
  getLeagues,
  createLeague,
  updateLeague,
  deleteLeague,
} = require("../services/leagueController");
const { protect, authorize } = require("../Middleware/authMiddleware");
const { cacheMiddleware, invalidateCache } = require("../Middleware/cache");

// Public — anyone can fetch league list for forms
router.get("/", cacheMiddleware(120, "leagues"), getLeagues);

// Protected — admin only writes
router.use(protect);
router.post("/", authorize("Admin", "Super Admin"), invalidateCache("leagues"), createLeague);
router.put("/:id", authorize("Admin", "Super Admin"), invalidateCache("leagues"), updateLeague);
router.delete("/:id", authorize("Admin", "Super Admin"), invalidateCache("leagues"), deleteLeague);

module.exports = router;
