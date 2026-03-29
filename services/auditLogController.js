const { getAuditLogs } = require("../Middleware/auditLogger");

// @desc    Get audit logs with filtering
// @route   GET /api/audit-logs
// @access  Private / Super Admin only
const getAllAuditLogs = async (req, res) => {
  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      user_id: req.query.user_id,
      action: req.query.action,
      resourceType: req.query.resource_type,
      resourceId: req.query.resource_id,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
    };

    const result = await getAuditLogs(filters);

    res.status(200).json(result);
  } catch (error) {
    console.error("Get audit logs error:", error.message);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

module.exports = {
  getAllAuditLogs,
};
