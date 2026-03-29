const express = require("express");
const router = express.Router();
const {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  getPublishedBlogs,
  togglePublish,
} = require("../services/blogController");
const { protect, authorize } = require("../Middleware/authMiddleware");
const { cacheMiddleware, invalidateCache } = require("../Middleware/cache");

// Public routes - cached for 60s
router.get("/", cacheMiddleware(60, 'blogs'), getPublishedBlogs);

// Protected routes
router.get("/all", protect, authorize("Admin", "Super Admin"), getAllBlogs);

// Public route - cached for 120s
router.get("/:identifier", cacheMiddleware(120, 'blogs'), getBlogById);

// Write operations invalidate blog cache
router.post("/", protect, authorize("Admin", "Super Admin"), invalidateCache('blogs'), createBlog);
router.put("/:id", protect, authorize("Admin", "Super Admin"), invalidateCache('blogs'), updateBlog);
router.patch("/:id/publish", protect, authorize("Admin", "Super Admin"), invalidateCache('blogs'), togglePublish);
router.delete("/:id", protect, authorize("Super Admin"), invalidateCache('blogs'), deleteBlog);

module.exports = router;
