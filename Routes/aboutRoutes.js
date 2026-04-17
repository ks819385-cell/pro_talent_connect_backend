const express = require("express");
const router = express.Router();
const {
  getAbout,
  getPartners,
  updateAbout,
  updatePartners,
  uploadImages,
} = require("../services/aboutController");
const { protect, authorize } = require("../Middleware/authMiddleware");
const { cacheMiddleware, invalidateCache } = require("../Middleware/cache");

// Public route - cached for 5 min (rarely changes)
router.get("/", cacheMiddleware(300, 'about'), getAbout);
router.get("/partners", cacheMiddleware(60, 'about'), getPartners);

// Protected routes with cache invalidation
router.put("/", protect, authorize("Super Admin"), invalidateCache('about'), updateAbout);
router.put("/partners", protect, authorize("Super Admin"), invalidateCache('about'), updatePartners);
router.post("/images", protect, authorize("Super Admin"), invalidateCache('about'), uploadImages);

module.exports = router;
