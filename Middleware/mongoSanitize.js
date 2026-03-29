/**
 * MongoDB Sanitization Middleware - Express 5 Compatible
 * Removes MongoDB operators ($, .) from request data to prevent NoSQL injection
 */

const logger = require("../config/logger");

/**
 * Check if value contains MongoDB operators
 */
const hasMaliciousContent = (value) => {
  if (typeof value === 'string') {
    return value.includes('$') || value.includes('.');
  }
  return false;
};

/**
 * Recursively sanitize an object by removing keys with $ or .
 */
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  Object.keys(obj).forEach(key => {
    // Remove keys that start with $ or contain .
    if (!key.startsWith('$') && !key.includes('.')) {
      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    } else {
      logger.warn(`Sanitized malicious key: ${key}`);
    }
  });

  return sanitized;
};

/**
 * Middleware to sanitize req.body, req.params, and req.query
 * Express 5 compatible - doesn't mutate readonly properties
 */
const mongoSanitize = () => {
  return (req, res, next) => {
    try {
      // Sanitize body (writable)
      if (req.body) {
        req.body = sanitizeObject(req.body);
      }

      // Sanitize params (writable)  
      if (req.params) {
        req.params = sanitizeObject(req.params);
      }

      // For query, we can't reassign in Express 5
      // Instead, check and reject if malicious
      if (req.query) {
        const keys = Object.keys(req.query);
        const maliciousKeys = keys.filter(key => 
          key.startsWith('$') || key.includes('.') || hasMaliciousContent(req.query[key])
        );

        if (maliciousKeys.length > 0) {
          logger.warn(`Blocked request with malicious query params: ${maliciousKeys.join(', ')} from ${req.ip}`);
          return res.status(400).json({
            success: false,
            message: 'Invalid query parameters detected',
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Error in mongoSanitize middleware:', error);
      next(error);
    }
  };
};

module.exports = mongoSanitize;
