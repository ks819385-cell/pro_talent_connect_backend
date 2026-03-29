require("dotenv").config({ path: require("path").join(__dirname, ".env") });

// Validate environment variables before starting
const validateEnv = require("./config/validateEnv");
validateEnv();

const connectDB = require("./config/DB");
const app = require("./app");
const logger = require("./config/logger");
const { seedLeagues } = require("./services/leagueController");
const keepAliveWorker = require("./services/keepAliveWorker");

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  logger.error(err.name, err.message);
  logger.error(err.stack);
  process.exit(1);
});

// Connect to Database
connectDB().then(async () => {
  // Seed default league data if empty
  await seedLeagues();

  // Start 24-hour MongoDB keep-alive background worker
  keepAliveWorker.start();

  const PORT = process.env.PORT || 5001;

  const server = app.listen(PORT, () => {
    logger.info(
      `🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`,
    );
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (err) => {
    logger.error("UNHANDLED REJECTION! 💥 Shutting down...");
    logger.error(err.name, err.message);
    server.close(() => {
      process.exit(1);
    });
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    logger.info("SIGTERM received. Shutting down gracefully...");
    server.close(() => {
      logger.info("Process terminated");
    });
  });
});
