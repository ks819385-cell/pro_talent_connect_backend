jest.mock("../config/logger", () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../Models/Players", () => ({ find: jest.fn() }));
jest.mock("../Models/Blog", () => ({ find: jest.fn() }));
jest.mock("../Models/Service", () => ({ find: jest.fn() }));
jest.mock("../Models/About", () => ({ findOne: jest.fn() }));
jest.mock("../Models/HowItWork", () => ({ find: jest.fn() }));

jest.mock("../Middleware/cache", () => ({
  cache: {
    set: jest.fn(),
  },
}));

const logger = require("../config/logger");
const Players = require("../Models/Players");
const Blog = require("../Models/Blog");
const Service = require("../Models/Service");
const About = require("../Models/About");
const HowItWork = require("../Models/HowItWork");
const { cache } = require("../Middleware/cache");

const {
  initCacheWarming,
  warmCacheKey,
  WARMING_TASKS,
} = require("../services/cacheWarmer");

describe("cacheWarmer service", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("exposes warming task definitions", () => {
    expect(Array.isArray(WARMING_TASKS)).toBe(true);
    expect(WARMING_TASKS.length).toBe(5);
  });

  it("skips warming in test environment", async () => {
    process.env.NODE_ENV = "test";

    await initCacheWarming();

    expect(cache.set).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      "Cache warming skipped in test environment"
    );
  });

  it("warms cache in non-test environments and continues on task failures", async () => {
    process.env.NODE_ENV = "development";

    const playersData = [{ name: "P1" }];
    const servicesData = [{ name: "S1" }];
    const aboutData = { title: "About" };
    const howItWorksData = [{ step: "one" }];

    Players.find.mockResolvedValue(playersData);
    Blog.find.mockRejectedValue(new Error("blog fail"));
    Service.find.mockResolvedValue(servicesData);
    About.findOne.mockResolvedValue(aboutData);
    HowItWork.find.mockResolvedValue(howItWorksData);

    await initCacheWarming();

    expect(cache.set).toHaveBeenCalledTimes(4);
    expect(cache.set).toHaveBeenCalledWith(
      "players:0:4",
      expect.objectContaining({
        data: playersData,
        timestamp: expect.any(Number),
      }),
      300
    );
    expect(cache.set).toHaveBeenCalledWith(
      "services",
      expect.objectContaining({
        data: servicesData,
        timestamp: expect.any(Number),
      }),
      900
    );
    expect(cache.set).toHaveBeenCalledWith(
      "about",
      expect.objectContaining({
        data: aboutData,
        timestamp: expect.any(Number),
      }),
      1200
    );
    expect(cache.set).toHaveBeenCalledWith(
      "how-it-works",
      expect.objectContaining({
        data: howItWorksData,
        timestamp: expect.any(Number),
      }),
      900
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Cache warming failed for blogs: blog fail")
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("4/5 successful, 1 failed")
    );
  });

  it("warmCacheKey returns success and writes to cache", async () => {
    const provider = jest.fn().mockResolvedValue({ hot: true });

    const result = await warmCacheKey("custom:key", provider, 120);

    expect(provider).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith("custom:key", { hot: true }, 120);
    expect(result).toEqual({
      success: true,
      message: "Cache warmed: custom:key",
    });
  });

  it("warmCacheKey returns failure when provider throws", async () => {
    const provider = jest.fn().mockRejectedValue(new Error("boom"));

    const result = await warmCacheKey("custom:key", provider);

    expect(cache.set).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, message: "boom" });
    expect(logger.error).toHaveBeenCalledWith(
      "Manual cache warm failed for custom:key: boom"
    );
  });
});
