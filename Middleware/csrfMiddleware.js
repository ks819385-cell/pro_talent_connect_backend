const csrf = require("csurf");

// CSRF protection middleware
// Uses double-submit cookie pattern (secure for API applications)
const csrfProtectionReal = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    domain: process.env.COOKIE_DOMAIN || undefined,
  },
});

const csrfProtection = (req, res, next) => {
  if (process.env.NODE_ENV === "development" || process.env.DISABLE_CSRF === "true") {
    req.csrfToken = () => "dev-csrf-token";
    return next();
  }
  return csrfProtectionReal(req, res, next);
};

// Middleware to generate and send CSRF token
// Used on GET requests (login page, forms) and after login
const generateCsrfToken = (req, res, next) => {
  // Get or create CSRF token and add to request
  res.locals.csrfToken = req.csrfToken();
  next();
};

// Safe CSRF error handler
// Returns JSON response instead of HTML
const csrfErrorHandler = (err, req, res, next) => {
  if (err.code !== "EBADCSRFTOKEN") return next(err);

  // Handle CSRF token errors
  return res.status(403).json({
    success: false,
    error: "CSRF validation failed",
    message: "Invalid or missing CSRF token",
  });
};

module.exports = {
  csrfProtection,
  generateCsrfToken,
  csrfErrorHandler,
};
