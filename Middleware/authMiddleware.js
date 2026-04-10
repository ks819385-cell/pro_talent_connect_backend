const jwt = require("jsonwebtoken");
const Admin = require("../Models/Admin");

// Protect routes — verify JWT token
const protect = async (req, res, next) => {
  let token;

  // Prefer explicit Authorization header over cookie token.
  // This keeps API behavior predictable when both are present.
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.adminToken) {
    token = req.cookies.adminToken;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach admin (without password) to request
      req.admin = await Admin.findById(decoded.id).select("-password");

      if (!req.admin) {
        return res.status(401).json({ message: "Admin not found" });
      }

      // Also attach as req.user for convenience
      req.user = req.admin;

      if (req.admin.activation_required || !req.admin.is_password_set) {
        return res.status(403).json({
          success: false,
          code: "ACTIVATION_REQUIRED",
          message: "Account activation is pending. Verify OTP and set your password to continue.",
        });
      }

      next();
    } catch (error) {
      console.error("Auth error:", error.message);
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

// Role-based access: only the listed roles are allowed
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ message: "Not authorized" });
    }
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        message: `Role '${req.admin.role}' is not authorized to access this resource`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
