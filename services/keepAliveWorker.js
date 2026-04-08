/**
 * keepAliveWorker.js
 *
 * Background worker that runs 3 random MongoDB queries every 24 hours.
 * Purpose: prevent free-tier Atlas clusters from pausing due to inactivity.
 */

const Player  = require("../Models/Players");
const Blog    = require("../Models/Blog");
const League  = require("../Models/League");
const logger  = require("../config/logger");

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

const QUERIES = [
  () => Player.countDocuments(),
  () => Blog.countDocuments(),
  () => League.countDocuments(),
  () => Player.findOne({}, { name: 1 }).lean(),
  () => Blog.findOne({}, { title: 1 }).lean(),
];

/**
 * Pick 3 distinct queries at random and run them sequentially.
 */
async function runKeepAlive() {
  logger.info("[keepAlive] Running 24-hour MongoDB keep-alive ping...");

  // Shuffle and take first 3
  const shuffled = QUERIES.slice().sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);

  for (let i = 0; i < selected.length; i++) {
    try {
      const result = await selected[i]();
      logger.info(`[keepAlive] Query ${i + 1}/3 OK - result: ${JSON.stringify(result)}`);
    } catch (err) {
      logger.warn(`[keepAlive] Query ${i + 1}/3 failed: ${err.message}`);
    }
  }

  logger.info("[keepAlive] Done. Next ping in 24 hours.");
}

function start() {
  // Run once shortly after startup (5 seconds), then every 24 hours
  setTimeout(() => {
    runKeepAlive();
    setInterval(runKeepAlive, INTERVAL_MS);
  }, 5000);

  logger.info("[keepAlive] Background worker scheduled (every 24 h).");
}

module.exports = { start };
