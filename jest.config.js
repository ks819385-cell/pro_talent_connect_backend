module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["./tests/setup.js"],
  testMatch: ["**/tests/**/*.test.js"],
  verbose: true,
  testTimeout: 180000,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
