const mongoose = require("mongoose");
const logger = require("./logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // How long the driver waits to find an available server
      serverSelectionTimeoutMS: 10000,
      // How long a send or receive on a socket can take before timing out
      socketTimeoutMS: 45000,
      // TCP keep-alive — prevents idle connections from being dropped by firewalls/Atlas
      family: 4,
      // Connection pool — avoids exhausting connections under load
      maxPoolSize: 10,
      minPoolSize: 2,
      // Heartbeat: ping the server every 10 s to detect stale connections fast
      heartbeatFrequencyMS: 10000,
      // Re-attempt an initial connection for up to 60 s before giving up
      connectTimeoutMS: 60000,
      // Keep retrying writes on a primary failover/reconnect
      retryWrites: true,
      retryReads: true,
    });

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`❌ MongoDB Connection Failed: ${error.message}`);
    logger.error('Cannot start server without database connection');

    // Exit process with failure
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on("disconnected", () => {
  logger.warn("⚠️  MongoDB disconnected. Attempting to reconnect...");
});

mongoose.connection.on("error", (err) => {
  logger.error(`❌ MongoDB connection error: ${err.message}`);
});

mongoose.connection.on("reconnected", () => {
  logger.info("✅ MongoDB reconnected");
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed through app termination');
  process.exit(0);
});

module.exports = connectDB;
