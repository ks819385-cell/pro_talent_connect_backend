const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");

// Routes
const authRoutes = require("./Routes/authRoutes");
const adminRoutes = require("./Routes/adminRoutes");
const playerRoutes = require("./Routes/playerRoutes");
const dashboardRoutes = require("./Routes/dashboardRoutes");
const blogRoutes = require("./Routes/blogRoutes");
const aboutRoutes = require("./Routes/aboutRoutes");
const auditLogRoutes = require("./Routes/auditLogRoutes");
const serviceRoutes = require("./Routes/serviceRoutes");
const contactRoutes = require("./Routes/contactRoutes");
const otpRoutes = require("./Routes/otpRoutes");
const leagueRoutes = require("./Routes/leagueRoutes");

// Middleware
const { apiLimiter } = require("./Middleware/rateLimiter");
const { errorHandler, notFound } = require("./Middleware/errorHandler");
const mongoSanitize = require("./Middleware/mongoSanitize");
const { csrfProtection, generateCsrfToken, csrfErrorHandler } = require("./Middleware/csrfMiddleware");
const logger = require("./config/logger");
const { getCacheStats, flushCache } = require("./Middleware/cache");

const app = express();

// Trust proxy (important for rate limiting behind nginx)
app.set("trust proxy", 1);


// ================= SECURITY =================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);


// ================= CORS FIX =================

// Default allowed origins (local dev only)
const defaultAllowedOrigins =
  process.env.NODE_ENV === "production"
    ? []
    : ["http://localhost:3000", "http://localhost:5173"];

// Read from .env
const envAllowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  : [];

// Merge + remove duplicates
const allowedOrigins = [
  ...new Set([...defaultAllowedOrigins, ...envAllowedOrigins]),
];

logger.info(`CORS allowlist loaded (${allowedOrigins.length} origins)`);

// Normalize origin
function normalizeOrigin(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/\/+$/, "")
    : value;
}

const corsOptions = {
  origin: function (origin, callback) {
    const normalizedOrigin = normalizeOrigin(origin);

    // Allow tools like Postman / curl
    if (!normalizedOrigin) {
      return callback(null, true);
    }

    // Allow all if "*" is present
    if (allowedOrigins.includes("*")) {
      return callback(null, true);
    }

    const isAllowed = allowedOrigins.some(
      (allowedOrigin) =>
        normalizeOrigin(allowedOrigin) === normalizedOrigin
    );

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log("❌ CORS BLOCKED:", normalizedOrigin);
      callback(new Error(`Not allowed by CORS: ${normalizedOrigin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  optionsSuccessStatus: 200,
};

// Apply CORS
app.use(cors(corsOptions));

// Safe preflight handler (no crash version)
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return cors(corsOptions)(req, res, next);
  }
  next();
});


// ================= BODY PARSER =================
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// ================= CSRF PROTECTION =================
// CSRF tokens required for all state-changing requests (POST, PUT, DELETE, PATCH)
app.use(csrfProtection);

// ================= SECURITY MIDDLEWARE =================
app.use(mongoSanitize());
app.use(compression());

// ================= RATE LIMIT =================
app.use(apiLimiter);

// ================= LOGGING =================
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// ================= HEALTH =================
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
  });
});

app.get("/ping", (req, res) => {
  res.status(200).json({
    success: true,
    message: "pong",
    timestamp: new Date().toISOString(),
  });
});

// ================= CACHE STATS (Development/Monitoring) =================
app.get("/cache/stats", (req, res) => {
  logger.debug("Cache stats requested");
  getCacheStats(req, res);
});

// Flush cache (admin endpoint - add auth in production)
app.post("/cache/flush", (req, res) => {
  logger.warn("Cache flush requested");
  flushCache(req, res);
});

// ================= ROOT =================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Pro-Talent-Connect API v1.0",
    documentation: "/api/docs",
  });
});

// ================= API ROUTES (Canonical v1 API) =================
// All routes mounted under /api/v1/* prefix for consistency and rate-limit protection
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admins", adminRoutes);
app.use("/api/v1/players", playerRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/blogs", blogRoutes);
app.use("/api/v1/about", aboutRoutes);
app.use("/api/v1/audit-logs", auditLogRoutes);
app.use("/api/v1/contact", contactRoutes);
app.use("/api/v1/otp", otpRoutes);
app.use("/api/v1/leagues", leagueRoutes);
// Services & How It Works define their own full paths (services, how-it-works)
app.use("/api/v1", serviceRoutes);

// ================= ERROR HANDLING =================
// CSRF token errors need specific handling (must be before generic error handler)
app.use(csrfErrorHandler);

app.use(notFound);
app.use(errorHandler);

module.exports = app;