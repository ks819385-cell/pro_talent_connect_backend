const request = require("supertest");
const express = require("express");
const appApi = require("../app");
const {
  cache,
  cacheMiddleware,
  invalidateCache,
  getCacheStats,
  flushCache,
} = require("../Middleware/cache");

describe("Cache module", () => {
  const resetCacheState = () => {
    cache.flush();
    cache.maxSize = 500;
    cache.defaultTTL = 300;
    cache.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalWrites: 0,
    };
  };

  beforeEach(() => {
    resetCacheState();
  });

  afterEach(() => {
    resetCacheState();
  });

  describe("LRUCache core behavior", () => {
    it("stores and returns cached values", () => {
      // Arrange
      cache.set("players:/api/v1/players", { ok: true }, 300);

      // Act
      const cached = cache.get("players:/api/v1/players");

      // Assert
      expect(cached).toEqual({ ok: true });
      expect(cache.getStats()).toEqual(
        expect.objectContaining({
          hits: 1,
          misses: 0,
          totalWrites: 1,
        })
      );
    });

    it("expires entries when expiry time has passed", () => {
      // Arrange
      cache.set("temp:key", { value: 123 }, 300);
      cache.cache.get("temp:key").expiry = Date.now() - 1;

      // Act
      const result = cache.get("temp:key");

      // Assert
      expect(result).toBeNull();
      expect(cache.cache.has("temp:key")).toBe(false);
      expect(cache.getStats().misses).toBe(1);
    });

    it("evicts least recently used key when max size is reached", () => {
      // Arrange
      cache.maxSize = 2;
      cache.set("key:a", { a: 1 }, 300);
      cache.set("key:b", { b: 1 }, 300);

      // Force deterministic LRU ordering (b is oldest)
      cache.cache.get("key:a").lastAccess = Date.now();
      cache.cache.get("key:b").lastAccess = Date.now() - 1000;

      // Act
      cache.set("key:c", { c: 1 }, 300);

      // Assert
      expect(cache.get("key:b")).toBeNull();
      expect(cache.get("key:a")).toEqual({ a: 1 });
      expect(cache.get("key:c")).toEqual({ c: 1 });
      expect(cache.getStats().evictions).toBe(1);
    });

    it("invalidates all keys for a prefix", () => {
      // Arrange
      cache.set("players:/list", { id: 1 }, 300);
      cache.set("players:/search?q=x", { id: 2 }, 300);
      cache.set("blogs:/list", { id: 3 }, 300);

      // Act
      cache.invalidate("players:");

      // Assert
      expect(cache.get("players:/list")).toBeNull();
      expect(cache.get("players:/search?q=x")).toBeNull();
      expect(cache.get("blogs:/list")).toEqual({ id: 3 });
    });
  });

  describe("cacheMiddleware", () => {
    it("returns MISS first then HIT on subsequent GET", async () => {
      // Arrange
      const app = express();
      let handlerRuns = 0;

      app.get("/data", cacheMiddleware(5, "unit"), (req, res) => {
        handlerRuns += 1;
        res.status(200).json({ handlerRuns });
      });

      // Act
      const first = await request(app).get("/data");
      const second = await request(app).get("/data");

      // Assert
      expect(first.status).toBe(200);
      expect(first.headers["x-cache"]).toBe("MISS");
      expect(first.body.handlerRuns).toBe(1);

      expect(second.status).toBe(200);
      expect(second.headers["x-cache"]).toBe("HIT");
      expect(second.headers["cache-control"]).toContain("max-age=5");
      expect(second.body.handlerRuns).toBe(1);
    });

    it("does not cache non-2xx responses", async () => {
      // Arrange
      const app = express();
      let attempts = 0;

      app.get("/bad", cacheMiddleware(5, "unit"), (req, res) => {
        attempts += 1;
        res.status(400).json({ attempts });
      });

      // Act
      const first = await request(app).get("/bad");
      const second = await request(app).get("/bad");

      // Assert
      expect(first.headers["x-cache"]).toBe("MISS");
      expect(second.headers["x-cache"]).toBe("MISS");
      expect(second.body.attempts).toBe(2);
    });
  });

  describe("invalidateCache middleware", () => {
    it("invalidates cache on successful write responses", async () => {
      // Arrange
      cache.set("players:/api/v1/players", { list: [1] }, 300);

      const app = express();
      app.use(express.json());
      app.post("/update", invalidateCache("players"), (req, res) => {
        res.status(200).json({ updated: true });
      });

      // Act
      await request(app).post("/update").send({});

      // Assert
      expect(cache.get("players:/api/v1/players")).toBeNull();
    });

    it("does not invalidate cache on failed write responses", async () => {
      // Arrange
      const key = "players:/api/v1/players";
      const cachedValue = { list: [1] };
      cache.set(key, cachedValue, 300);

      const app = express();
      app.use(express.json());
      app.post("/update", invalidateCache("players"), (req, res) => {
        res.status(400).json({ updated: false });
      });

      // Act
      await request(app).post("/update").send({});

      // Assert
      expect(cache.get(key)).toEqual(cachedValue);
    });
  });

  describe("cache helpers", () => {
    it("returns stats payload from getCacheStats", () => {
      // Arrange
      cache.set("stats:key", { value: 1 }, 300);
      const res = { json: jest.fn() };

      // Act
      getCacheStats({}, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          cache: expect.objectContaining({
            size: 1,
            totalWrites: 1,
          }),
          message: "Cache statistics retrieved successfully",
        })
      );
    });

    it("flushes all cache entries from flushCache", () => {
      // Arrange
      cache.set("flush:key", { value: 1 }, 300);
      const res = { json: jest.fn() };

      // Act
      flushCache({}, res);

      // Assert
      expect(cache.size).toBe(0);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Cache flushed successfully",
      });
    });
  });

  describe("cache endpoint integration", () => {
    it("GET /cache/stats returns cache metrics", async () => {
      const res = await request(appApi).get("/cache/stats");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          cache: expect.objectContaining({
            size: expect.any(Number),
            maxSize: expect.any(Number),
            hitRate: expect.any(String),
          }),
        })
      );
    });

    it("POST /cache/flush succeeds with a valid CSRF token", async () => {
      const agent = request.agent(appApi);

      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .post("/cache/flush")
        .set("X-CSRF-Token", csrfToken)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Cache flushed successfully",
      });
    });
  });
});
