const request = require("supertest");
const app = require("../app");
const Admin = require("../Models/Admin");
const Player = require("../Models/Players");

describe("Dashboard API", () => {
  let token;
  let agent;

  beforeEach(async () => {
    // Use agent to maintain cookies across requests
    agent = request.agent(app);

    const admin = await Admin.create({
      name: "Admin",
      email: "admin@test.com",
      password: "Password@123",
      role: "Admin",
    });

    // Get CSRF token
    const csrfRes = await agent.get("/api/v1/auth/csrf-token");
    const csrfToken = csrfRes.body.csrfToken;

    const loginRes = await agent
      .post("/api/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({
        email: "admin@test.com",
        password: "Password@123",
      });
    token = loginRes.body.token;
  });

  it("should get dashboard stats", async () => {
    await Player.create({
      name: "Player 1",
      playingPosition: "Forward",
      playerId: "PL0000000001",
      dateOfBirth: new Date(),
      gender: "Male",
      mobileNumber: "111",
      email: "p1@test.com",
    });

    const res = await agent
      .get("/api/v1/dashboard/stats")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalPlayers).toBe(1);
    expect(res.body.totalAdmins).toBe(1);
  });
});
