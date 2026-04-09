/**
 * Enhanced In-Memory Cache Middleware with LRU Eviction
 * Implements Cache-Aside pattern with TTL and LRU eviction
 * No external dependencies required
 */

const logger = require('../config/logger');

class CacheEntry {
  constructor(data, ttl) {
    this.data = data;
    this.expiry = Date.now() + ttl * 1000;
    this.accessCount = 0; // For LFU stats
    this.lastAccess = Date.now();
  }

  isExpired() {
    return Date.now() > this.expiry;
  }

  access() {
    this.lastAccess = Date.now();
    this.accessCount++;
  }
}

class LRUCache {
  constructor(maxSize = 500, defaultTTL = 300) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.cache = new Map();
    this.timers = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalWrites: 0,
    };
  }

  /**
   * Get value from cache (implements Cache-Aside pattern read)
   * @param {string} key - Cache key
   * @returns {*} Cached data or null
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (entry.isExpired()) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access metrics for LRU
    entry.access();
    this.stats.hits++;
    return entry.data;
  }

  /**
   * Set value in cache with optional eviction (implements Cache-Aside write)
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   * @param {number} ttl - Time-to-live in seconds (default: 300s)
   */
  set(key, data, ttl = this.defaultTTL) {
    // Clear existing timer if present
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Check if we need to evict (LRU when cache is full)
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this._evictLRU();
    }

    const entry = new CacheEntry(data, ttl);
    this.cache.set(key, entry);
    this.stats.totalWrites++;

    // Auto-cleanup after expiry
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl * 1000);

    if (timer.unref) timer.unref(); // Don't keep process alive
    this.timers.set(key, timer);
  }

  /**
   * Delete specific key
   */
  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    this.cache.delete(key);
  }

  /**
   * Evict least recently used entry
   */
  _evictLRU() {
    let lruKey = null;
    let lruTime = Infinity;

    // Find entry with oldest lastAccess time
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < lruTime) {
        lruTime = entry.lastAccess;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.delete(lruKey);
      this.stats.evictions++;
      logger.debug(`LRU Cache evicted: ${lruKey}`);
    }
  }

  /**
   * Invalidate all entries matching a prefix pattern (for cache invalidation)
   */
  invalidate(prefix) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.delete(key));
  }

  /**
   * Clear entire cache
   */
  flush() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.timers.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2)
      : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: `${hitRate}%`,
      evictions: this.stats.evictions,
      totalWrites: this.stats.totalWrites,
    };
  }

  /**
   * Get cache size
   */
  get size() {
    return this.cache.size;
  }
}

// Singleton cache instance with default config
const cache = new LRUCache(500, 300); // 500 max entries, 300s default TTL

/**
 * Cache-Aside middleware for GET endpoints
 * Checks cache first, falls back to handler, then updates cache
 * @param {number} ttl - Time to live in seconds (default: 300)
 * @param {string} prefix - Cache key prefix for invalidation grouping
 */
const cacheMiddleware = (ttl = 300, prefix = '') => {
  return (req, res, next) => {
    // Only cache GET requests with 2xx status codes
    if (req.method !== 'GET') {
      return next();
    }

    // Build cache key from URL + query params
    const key = `${prefix}:${req.originalUrl}`;
    const cached = cache.get(key);

    if (cached) {
      logger.debug(`Cache HIT: ${key}`);
      res.set('X-Cache', 'HIT');
      res.set('Cache-Control', `public, max-age=${ttl}`);
      return res.status(200).json(cached);
    }

    logger.debug(`Cache MISS: ${key}`);
    res.set('X-Cache', 'MISS');
    res.set('Cache-Control', `public, max-age=${ttl}`);

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful responses (200-299)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, body, ttl);
      }
      return originalJson(body);
    };

    next();
  };
};

/**
 * Write-Through cache for write operations
 * Data is written to database first, then cache is invalidated
 * Ensures consistency
 */
const invalidateCache = (...prefixes) => {
  return (req, res, next) => {
    // Intercept after response is sent
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Write-Through: Invalidate on successful write operations (201, 200)
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

/**
 * Cache warming endpoint - pre-populate hot data
 * Useful for reducing initial performance hit after restart
 * @param {Array} warmingTasks - Array of {key, fn, ttl}
 */
const cacheWarming = async (warmingTasks) => {
  logger.info('Starting cache warming...');
  let warmed = 0;

  for (const task of warmingTasks) {
    try {
      const data = await task.fn();
      cache.set(task.key, data, task.ttl || 600);
      warmed++;
      logger.debug(`Cache warmed: ${task.key}`);
    } catch (error) {
      logger.error(`Cache warming failed for ${task.key}: ${error.message}`);
    }
  }

  logger.info(`Cache warming complete: ${warmed}/${warmingTasks.length} items`);
};

/**
 * Health check and statistics endpoint
 */
const getCacheStats = (req, res) => {
  const stats = cache.getStats();
  res.json({
    success: true,
    cache: stats,
    message: 'Cache statistics retrieved successfully',
  });
};

/**
 * Manual cache flush endpoint (use with caution)
 */
const flushCache = (req, res) => {
  cache.flush();
  logger.warn('Cache flushed manually');
  res.json({
    success: true,
    message: 'Cache flushed successfully',
  });
};

module.exports = {
  cache,
  cacheMiddleware,
  invalidateCache,
  cacheWarming,
  getCacheStats,
  flushCache,
};
