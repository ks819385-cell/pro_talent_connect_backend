const express = require("express");
const router = express.Router();
const {
  submitEnquiry,
  submitProfileRequest,
  getAllEnquiries,
  getAllProfileRequests,
  updateEnquiryStatus,
  updateProfileRequestStatus,
} = require("../services/contactController");
const { protect } = require("../Middleware/authMiddleware");

// Public routes
router.post("/enquiry", submitEnquiry);
router.post("/profile-request", submitProfileRequest);

// Protected routes (Admin only)
router.get("/enquiries", protect, getAllEnquiries);
router.get("/profile-requests", protect, getAllProfileRequests);
router.put("/enquiries/:id", protect, updateEnquiryStatus);
router.put("/profile-requests/:id", protect, updateProfileRequestStatus);

module.exports = router;
