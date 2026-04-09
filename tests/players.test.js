const request = require("supertest");
const app = require("../app");
const Admin = require("../Models/Admin");
const Player = require("../Models/Players");
const Otp = require("../Models/Otp");

describe("Players API", () => {
  let token;
  let superToken;
  let agent;

  const createValidPlayerPayload = (overrides = {}) => ({
    name: "John Doe",
    playingPosition: "Forward",
    playerId: "PL0000000001",
    dateOfBirth: "2000-01-01",
    gender: "Male",
    mobileNumber: "1234567890",
    email: "john@test.com",
    age_group: "Senior",
    preferredFoot: "Right",
    nationality: "Indian",
    profileImage: "https://example.com/image.jpg",
    ...overrides,
  });

  const createVerifiedOtp = async (email) => {
    await Otp.create({
      email,
      otp: "123456",
      purpose: "player-creation",
      verified: true,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
  };

  beforeEach(async () => {
    // Use agent to maintain cookies across requests
    const request_module = require("supertest");
    agent = request_module.agent(app);

    // Setup Admin
    const admin = await Admin.create({
      name: "Admin",
      email: "admin@test.com",
      password: "Password@123",
      role: "Admin",
    });

    const superAdmin = await Admin.create({
      name: "Super Admin",
      email: "super@test.com",
      password: "Password@123",
      role: "Super Admin",
    });

    // Get CSRF token using agent
    let csrfRes = await agent.get("/api/v1/auth/csrf-token");
    let csrfToken = csrfRes.body.csrfToken;

    const loginRes = await agent
      .post("/api/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({
        email: "admin@test.com",
        password: "Password@123",
      });
    token = loginRes.body.token;

    // Get new CSRF token for super admin login
    csrfRes = await agent.get("/api/v1/auth/csrf-token");
    csrfToken = csrfRes.body.csrfToken;

    const superLoginRes = await agent
      .post("/api/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({
        email: "super@test.com",
        password: "Password@123",
      });
    superToken = superLoginRes.body.token;
  });

  describe("POST /api/v1/players", () => {
    it("should create a player by super admin", async () => {
      const payload = createValidPlayerPayload();
      await createVerifiedOtp(payload.email);

      // Get fresh CSRF token
      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .post("/api/v1/players")
        .set("Authorization", `Bearer ${superToken}`)
        .set("X-CSRF-Token", csrfToken)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("John Doe");
      expect(res.body.profileImage).toBe("https://example.com/image.jpg");
    });

    it("should fail to create player by regular admin", async () => {
      const payload = createValidPlayerPayload();
      await createVerifiedOtp(payload.email);

      // Get fresh CSRF token
      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .post("/api/v1/players")
        .set("Authorization", `Bearer ${token}`)
        .set("X-CSRF-Token", csrfToken)
        .send(payload);

      expect(res.status).toBe(403);
    });

    it("should fail if required fields missing", async () => {
      // Get fresh CSRF token
      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .post("/api/v1/players")
        .set("Authorization", `Bearer ${superToken}`)
        .set("X-CSRF-Token", csrfToken)
        .send({
          name: "John Doe",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation error");
    });

    it("should fail if playerId is duplicate", async () => {
      await Player.create({
        name: "Existing",
        playingPosition: "Forward",
        playerId: "PL0000000001",
        dateOfBirth: new Date(),
        gender: "Male",
        mobileNumber: "0000000000",
        email: "existing@test.com",
      });

      const payload = createValidPlayerPayload({
        playerId: "PL0000000001",
        email: "new-email@test.com",
      });
      await createVerifiedOtp(payload.email);

      // Get fresh CSRF token
      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .post("/api/v1/players")
        .set("Authorization", `Bearer ${superToken}`)
        .set("X-CSRF-Token", csrfToken)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Duplicate playerId or email");
    });
  });

  describe("GET /api/v1/players", () => {
    it("should return all players for regular admin", async () => {
      await Player.create({
        name: "Player 1",
        playingPosition: "Forward",
        playerId: "PL0000000002",
        dateOfBirth: new Date(),
        gender: "Male",
        mobileNumber: "111",
        email: "p1@test.com",
      });

      const res = await agent
        .get("/api/v1/players")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.players.length).toBe(1);
    });
  });

  describe("PUT /api/v1/players/:id", () => {
    it("should update a player's image", async () => {
      const player = await Player.create({
        name: "Old Name",
        playingPosition: "Forward",
        playerId: "PL0000000003",
        dateOfBirth: new Date(),
        gender: "Male",
        mobileNumber: "999",
        email: "old@test.com",
        profileImage: "old-image.jpg",
      });

      // Get fresh CSRF token
      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .put(`/api/v1/players/${player._id}`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-CSRF-Token", csrfToken)
        .send({
          profileImage: "new-image.jpg",
        });

      expect(res.status).toBe(200);
      expect(res.body.profileImage).toBe("new-image.jpg");
    });
  });
});
