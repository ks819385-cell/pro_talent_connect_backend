const AuditLog = require("../Models/AuditLog");

/**
 * Log an action to the audit trail
 * @param {Object} params - Audit log parameters
 * @param {Object} params.user - User object from req.admin (or req.user)
 * @param {String} params.action - Action type (CREATE, UPDATE, DELETE, etc.)
 * @param {String} params.resourceType - Resource type (Admin, Player, Blog, etc.)
 * @param {String} params.resourceId - Resource ID (optional)
 * @param {String} params.description - Description of the action
 * @param {Object} params.req - Express request object (optional, for IP and user agent)
 * @param {Object} params.changes - Changes made (optional)
 * @param {String} params.status - Status (SUCCESS or FAILURE, default: SUCCESS)
 */
const logAction = async ({
  user,
  action,
  resourceType,
  resourceId = null,
  description,
  req = null,
  changes = null,
  status = "SUCCESS",
}) => {
  try {
    // Skip logging if user object doesn't have required fields
    if (!user || !user._id || !user.name || !user.role) {
      console.warn("Skipping audit log: insufficient user information");
      return null;
    }

    const auditLog = await AuditLog.create({
      user_id: user._id,
      user_name: user.name,
      user_email: user.email,
      user_role: user.role,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      description,
      ip_address: req ? req.ip || req.connection.remoteAddress : null,
      user_agent: req ? req.get("user-agent") : null,
      changes,
      status,
    });

    return auditLog;
  } catch (error) {
    // Log error but don't throw - audit logging should not break the main flow
    console.error("Audit logging error:", error.message);
    return null;
  }
};

/**
 * Get audit logs with filtering and pagination
 * @param {Object} filters - Filter options
 * @param {Number} filters.page - Page number
 * @param {Number} filters.limit - Results per page
 * @param {String} filters.user_id - Filter by user ID
 * @param {String} filters.action - Filter by action type
 * @param {String} filters.resourceType - Filter by resource type
 * @param {String} filters.resourceId - Filter by resource ID
 * @param {Date} filters.startDate - Filter from date
 * @param {Date} filters.endDate - Filter to date
 */
const getAuditLogs = async (filters = {}) => {
  try {
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {};

    if (filters.user_id) query.user_id = filters.user_id;
    if (filters.action) query.action = filters.action;
    if (filters.resourceType) query.resource_type = filters.resourceType;
    if (filters.resourceId) query.resource_id = filters.resourceId;

    // Date range filter
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const totalResults = await AuditLog.countDocuments(query);
    const totalPages = Math.ceil(totalResults / limit);

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      success: true,
      count: logs.length,
      totalResults,
      totalPages,
      currentPage: page,
      logs,
    };
  } catch (error) {
    console.error("Get audit logs error:", error.message);
    throw new Error("Failed to retrieve audit logs");
  }
};

module.exports = {
  logAction,
  getAuditLogs,
};
