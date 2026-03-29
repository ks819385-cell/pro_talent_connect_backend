const express = require("express");
const router = express.Router();
const {
  getAbout,
  updateAbout,
  uploadImages,
} = require("../services/aboutController");
const { protect, authorize } = require("../Middleware/authMiddleware");
const { cacheMiddleware, invalidateCache } = require("../Middleware/cache");

// Public route - cached for 5 min (rarely changes)
router.get("/", cacheMiddleware(300, 'about'), getAbout);

// Protected routes with cache invalidation
router.put("/", protect, authorize("Super Admin"), invalidateCache('about'), updateAbout);
router.post("/images", protect, authorize("Super Admin"), invalidateCache('about'), uploadImages);

module.exports = router;
