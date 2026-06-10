const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect, authorize } = require("../Middleware/authMiddleware");
const { uploadLimiter } = require("../Middleware/rateLimiter");
const { uploadProfileImage } = require("../services/uploadController");

// Early Content-Length check to reject payloads > 5MB
const checkContentLength = (req, res, next) => {
  const contentLength = parseInt(req.headers["content-length"], 10);
  if (contentLength && contentLength > 5 * 1024 * 1024) {
    return res.status(400).json({
      success: false,
      message: "File size exceeds 5MB limit",
    });
  }
  next();
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Route wrapper to handle multer errors gracefully
const handleUpload = (req, res, next) => {
  upload.single("profileImage")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: "File size exceeds 5MB limit",
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.code}`,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || "An error occurred during file upload",
      });
    }
    next();
  });
};

router.post(
  "/profile-image",
  uploadLimiter,
  protect,
  authorize("Admin", "Super Admin"),
  checkContentLength,
  handleUpload,
  uploadProfileImage
);

module.exports = router;
