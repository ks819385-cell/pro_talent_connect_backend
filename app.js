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
const logger = require("./config/logger");

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

// Default allowed origins (local dev)
const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://www.protalentconnect.co.in",
  "https://protalentconnect.co.in",
  "https://protalentconnect.com",
  "https://www.protalentconnect.com",
  "https://pro-talent-connect-frontend.vercel.app",
];

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
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};

// Apply CORS
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

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

// ================= SECURITY MIDDLEWARE =================
app.use(mongoSanitize());
app.use(compression());

// ================= RATE LIMIT =================
app.use("/api/", apiLimiter);

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

// ================= ROOT =================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Pro-Talent-Connect API v1.0",
    documentation: "/api/docs",
  });
});

// ================= API ROUTES =================
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admins", adminRoutes);
app.use("/api/v1/players", playerRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/blogs", blogRoutes);
app.use("/api/v1/about", aboutRoutes);
app.use("/api/v1/audit-logs", auditLogRoutes);
app.use("/api/v1", serviceRoutes);
app.use("/api/v1/contact", contactRoutes);
app.use("/api/v1/otp", otpRoutes);
app.use("/api/v1/leagues", leagueRoutes);

// Legacy routes
app.use("/api/auth", authRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/about", aboutRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api", serviceRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/leagues", leagueRoutes);

// Proxy fallback routes
app.use("/v1/auth", authRoutes);
app.use("/v1/admins", adminRoutes);
app.use("/v1/players", playerRoutes);
app.use("/v1/dashboard", dashboardRoutes);
app.use("/v1/blogs", blogRoutes);
app.use("/v1/about", aboutRoutes);
app.use("/v1/audit-logs", auditLogRoutes);
app.use("/v1", serviceRoutes);
app.use("/v1/contact", contactRoutes);
app.use("/v1/otp", otpRoutes);
app.use("/v1/leagues", leagueRoutes);

app.use("/auth", authRoutes);
app.use("/admins", adminRoutes);
app.use("/players", playerRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/blogs", blogRoutes);
app.use("/about", aboutRoutes);
app.use("/audit-logs", auditLogRoutes);
app.use("/", serviceRoutes);
app.use("/contact", contactRoutes);
app.use("/otp", otpRoutes);
app.use("/leagues", leagueRoutes);

// ================= ERROR HANDLING =================
app.use(notFound);
app.use(errorHandler);

module.exports = app;