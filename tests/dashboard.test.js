const request = require("supertest");
const app = require("../app");
const Admin = require("../Models/Admin");
const Player = require("../Models/Players");

describe("Dashboard API", () => {
  let token;

  beforeEach(async () => {
    const admin = await Admin.create({
      name: "Admin",
      email: "admin@test.com",
      password: "Password@123",
      role: "Admin",
    });

    const loginRes = await request(app).post("/api/auth/login").send({
      email: "admin@test.com",
      password: "Password@123",
    });
    token = loginRes.body.token;
  });

  it("should get dashboard stats", async () => {
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
      .get("/api/dashboard/stats")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalPlayers).toBe(1);
    expect(res.body.totalAdmins).toBe(1);
  });
});
