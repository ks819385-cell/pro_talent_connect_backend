const express = require("express");
const router = express.Router();
const { getDashboardStats } = require("../services/dashboardController");
const { protect, authorize } = require("../Middleware/authMiddleware");

// Protected — any authenticated admin
router.get("/stats", protect, authorize("Admin", "Super Admin"), getDashboardStats);

module.exports = router;
