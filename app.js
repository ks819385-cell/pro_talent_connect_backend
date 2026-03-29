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

// Trust proxy - important for rate limiting behind reverse proxy
app.set("trust proxy", 1);

// Security Headers
app.use(helmet({
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
}));

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["http://localhost:3000", "http://localhost:5173"];

    // In production, don't allow requests with no origin
    if (process.env.NODE_ENV === 'production' && !origin) {
      return callback(new Error("Not allowed by CORS"), false);
    }

    // In development, allow no origin (Postman, etc.)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Body parser with size limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
// Custom Express 5 compatible middleware
app.use(mongoSanitize());

// Compression middleware
app.use(compression());

// Apply rate limiting to all routes
app.use('/api/', apiLimiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Health check route (no rate limiting)
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
  });
});

// Ping route — lightweight keep-alive endpoint
app.get("/ping", (req, res) => {
  res.status(200).json({ success: true, message: "pong", timestamp: new Date().toISOString() });
});

// Basic Route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Pro-Talent-Connect API v1.0",
    documentation: "/api/docs",
  });
});

// API Routes v1
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

// Legacy routes (for backward compatibility - to be deprecated)
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

// 404 handler
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
