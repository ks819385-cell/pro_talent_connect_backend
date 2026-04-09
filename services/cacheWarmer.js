/**
 * Cache Warming Service
 * Pre-populates hot data on application startup
 * Reduces cold start hit performance impact
 */

const logger = require('../config/logger');
const Players = require('../Models/Players');
const Blog = require('../Models/Blog');
const Service = require('../Models/Service');
const About = require('../Models/About');
const HowItWork = require('../Models/HowItWork');
const { cache } = require('../Middleware/cache');

/**
 * Define warm data tasks - populate frequently accessed data
 * Goal: Reduce initial DB load spikes
 */
const WARMING_TASKS = [
  {
    name: 'players',
    key: 'players:0:4',
    fn: () => Players.find({}, null, { limit: 4, skip: 0 }),
    ttl: 300, // 5 minutes
  },
  {
    name: 'blogs',
    key: 'blogs:0:6',
    fn: () => Blog.find({}, null, { limit: 6, skip: 0 }),
    ttl: 600, // 10 minutes
  },
  {
    name: 'services',
    key: 'services',
    fn: () => Service.find({}),
    ttl: 900, // 15 minutes
  },
  {
    name: 'about',
    key: 'about',
    fn: () => About.findOne({}),
    ttl: 1200, // 20 minutes
  },
  {
    name: 'howItWorks',
    key: 'how-it-works',
    fn: () => HowItWork.find({}),
    ttl: 900, // 15 minutes
  },
];

/**
 * Initialize cache warming
 * Called on app startup in production/staging
 */
const initCacheWarming = async () => {
  // Skip warming in test environment
  if (process.env.NODE_ENV === 'test') {
    logger.debug('Cache warming skipped in test environment');
    return;
  }

  logger.info('Starting cache warming...');
  let warmed = 0;
  let failed = 0;

  for (const task of WARMING_TASKS) {
    try {
      const data = await task.fn();
      cache.set(task.key, { data, timestamp: Date.now() }, task.ttl);
      warmed++;
      logger.debug(`Cache warmed: ${task.name} (${task.key})`);
    } catch (error) {
      failed++;
      logger.warn(`Cache warming failed for ${task.name}: ${error.message}`);
    }
  }

  logger.info(
    `Cache warming complete: ${warmed}/${WARMING_TASKS.length} successful, ${failed} failed`
  );
};

/**
 * Warm a specific cache key (function-based, not task-based)
 * Useful for manual cache refreshes
 */
const warmCacheKey = async (key, fn, ttl = 600) => {
  try {
    const data = await fn();
    cache.set(key, data, ttl);
    logger.debug(`Manual cache warm: ${key}`);
    return { success: true, message: `Cache warmed: ${key}` };
  } catch (error) {
    logger.error(`Manual cache warm failed for ${key}: ${error.message}`);
    return { success: false, message: error.message };
  }
};

module.exports = {
  initCacheWarming,
  warmCacheKey,
  WARMING_TASKS,
};
