const express = require("express");
const router = express.Router();
const { getAllAuditLogs } = require("../services/auditLogController");
const { protect, authorize } = require("../Middleware/authMiddleware");

// Super Admin only - view audit logs
router.get("/", protect, authorize("Super Admin"), getAllAuditLogs);

module.exports = router;
