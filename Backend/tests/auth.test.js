const request = require("supertest");
const app = require("../app");
const Admin = require("../Models/Admin");

describe("Auth API", () => {
  describe("POST /api/auth/register", () => {
    it("should register a new admin if super admin", async () => {
      // Create a super admin first
      const superAdmin = await Admin.create({
        name: "Super Admin",
        email: "super@test.com",
        password: "Password@123",
        role: "Super Admin",
      });

      const loginRes = await request(app).post("/api/auth/login").send({
        email: "super@test.com",
        password: "Password@123",
      });

      const token = loginRes.body.token;

      const res = await request(app)
        .post("/api/auth/register")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Regular Admin",
          email: "admin@test.com",
          password: "Password@123",
          role: "Admin",
        });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe("admin@test.com");
    });

    it("should fail if not authorized", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Admin",
        email: "admin@test.com",
        password: "Password@123",
      });

      expect(res.status).toBe(401);
    });

    it("should fail if not super admin", async () => {
      // Create a regular admin
      await Admin.create({
        name: "Regular Admin",
        email: "admin@test.com",
        password: "Password@123",
        role: "Admin",
      });

      const loginRes = await request(app).post("/api/auth/login").send({
        email: "admin@test.com",
        password: "Password@123",
      });

      const token = loginRes.body.token;

      const res = await request(app)
        .post("/api/auth/register")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Another Admin",
          email: "another@test.com",
          password: "Password@123",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login with valid credentials", async () => {
      await Admin.create({
        name: "Admin",
        email: "admin@test.com",
        password: "Password@123",
      });

      const res = await request(app).post("/api/auth/login").send({
        email: "admin@test.com",
        password: "Password@123",
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
    });

    it("should fail with invalid credentials", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@test.com",
        password: "Password@123",
      });

      expect(res.status).toBe(401);
    });
  });
});
