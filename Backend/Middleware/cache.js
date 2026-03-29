/**
 * In-Memory Cache Middleware
 * Caches GET responses to reduce DB load on public endpoints
 * No external dependencies required
 */

const logger = require('../config/logger');

class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.del(key);
      return null;
    }
    return item.data;
  }

  set(key, data, ttlSeconds = 60) {
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000,
    });

    // Auto-cleanup after expiry
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, ttlSeconds * 1000);

    // Don't keep process alive for cache timers
    if (timer.unref) timer.unref();
    this.timers.set(key, timer);
  }

  del(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    this.cache.delete(key);
  }

  // Clear all entries matching a prefix pattern
  invalidate(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.del(key);
      }
    }
  }

  // Clear entire cache
  flush() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.timers.clear();
  }

  get size() {
    return this.cache.size;
  }
}

// Singleton cache instance
const cache = new MemoryCache();

/**
 * Cache middleware for GET endpoints
 * @param {number} ttl - Time to live in seconds (default: 60)
 * @param {string} prefix - Cache key prefix for invalidation grouping
 */
const cacheMiddleware = (ttl = 60, prefix = '') => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Build cache key from URL + query params
    const key = `${prefix}:${req.originalUrl}`;
    const cached = cache.get(key);

    if (cached) {
      logger.debug(`Cache HIT: ${key}`);
      res.set('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    logger.debug(`Cache MISS: ${key}`);
    res.set('X-Cache', 'MISS');

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, body, ttl);
      }
      return originalJson(body);
    };

    next();
  };
};

/**
 * Middleware to invalidate cache on write operations
 * @param  {...string} prefixes - Cache prefixes to invalidate
 */
const invalidateCache = (...prefixes) => {
  return (req, res, next) => {
    // Intercept after response is sent
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Invalidate on successful write operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        prefixes.forEach((prefix) => {
          cache.invalidate(prefix);
          logger.debug(`Cache INVALIDATED: ${prefix}*`);
        });
      }
      return originalJson(body);
    };
    next();
  };
};

module.exports = {
  cache,
  cacheMiddleware,
  invalidateCache,
};
