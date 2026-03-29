const request = require("supertest");
const app = require("../app");
const Admin = require("../Models/Admin");
const Player = require("../Models/Players");
const Otp = require("../Models/Otp");

describe("Players API", () => {
  let token;
  let superToken;

  const createValidPlayerPayload = (overrides = {}) => ({
    name: "John Doe",
    playingPosition: "Forward",
    playerId: "P001",
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

    const loginRes = await request(app).post("/api/auth/login").send({
      email: "admin@test.com",
      password: "Password@123",
    });
    token = loginRes.body.token;

    const superLoginRes = await request(app).post("/api/auth/login").send({
      email: "super@test.com",
      password: "Password@123",
    });
    superToken = superLoginRes.body.token;
  });

  describe("POST /api/players", () => {
    it("should create a player by super admin", async () => {
      const payload = createValidPlayerPayload();
      await createVerifiedOtp(payload.email);

      const res = await request(app)
        .post("/api/players")
        .set("Authorization", `Bearer ${superToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("John Doe");
      expect(res.body.profileImage).toBe("https://example.com/image.jpg");
    });

    it("should fail to create player by regular admin", async () => {
      const payload = createValidPlayerPayload();
      await createVerifiedOtp(payload.email);

      const res = await request(app)
        .post("/api/players")
        .set("Authorization", `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(403);
    });

    it("should fail if required fields missing", async () => {
      const res = await request(app)
        .post("/api/players")
        .set("Authorization", `Bearer ${superToken}`)
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
        playerId: "P001",
        dateOfBirth: new Date(),
        gender: "Male",
        mobileNumber: "0000000000",
        email: "existing@test.com",
      });

      const payload = createValidPlayerPayload({
        playerId: "P001",
        email: "new-email@test.com",
      });
      await createVerifiedOtp(payload.email);

      const res = await request(app)
        .post("/api/players")
        .set("Authorization", `Bearer ${superToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Duplicate playerId or email");
    });
  });

  describe("GET /api/players", () => {
    it("should return all players for regular admin", async () => {
      await Player.create({
        name: "Player 1",
        playingPosition: "Forward",
        playerId: "P001",
        dateOfBirth: new Date(),
        gender: "Male",
        mobileNumber: "111",
        email: "p1@test.com",
      });

      const res = await request(app)
        .get("/api/players")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.players.length).toBe(1);
    });
  });

  describe("PUT /api/players/:id", () => {
    it("should update a player's image", async () => {
      const player = await Player.create({
        name: "Old Name",
        playingPosition: "Forward",
        playerId: "P999",
        dateOfBirth: new Date(),
        gender: "Male",
        mobileNumber: "999",
        email: "old@test.com",
        profileImage: "old-image.jpg",
      });

      const res = await request(app)
        .put(`/api/players/${player._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          profileImage: "new-image.jpg",
        });

      expect(res.status).toBe(200);
      expect(res.body.profileImage).toBe("new-image.jpg");
    });
  });
});
