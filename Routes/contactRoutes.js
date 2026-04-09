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
const { protect, authorize } = require("../Middleware/authMiddleware");
const {
  validate,
  enquirySchema,
  profileRequestSchema,
  enquiryStatusSchema,
  profileRequestStatusSchema,
} = require("../Middleware/validator");

// Public routes
router.post("/enquiry", validate(enquirySchema), submitEnquiry);
router.post("/profile-request", validate(profileRequestSchema), submitProfileRequest);

// Protected routes (Admin only)
router.get("/enquiries", protect, authorize("Admin", "Super Admin"), getAllEnquiries);
router.get("/profile-requests", protect, authorize("Admin", "Super Admin"), getAllProfileRequests);
router.put("/enquiries/:id", protect, authorize("Admin", "Super Admin"), validate(enquiryStatusSchema), updateEnquiryStatus);
router.put("/profile-requests/:id", protect, authorize("Admin", "Super Admin"), validate(profileRequestStatusSchema), updateProfileRequestStatus);

module.exports = router;
