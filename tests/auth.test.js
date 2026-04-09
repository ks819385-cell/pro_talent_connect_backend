const request = require("supertest");
const app = require("../app");
const Admin = require("../Models/Admin");

describe("Auth API", () => {
  let agent;

  beforeEach(async () => {
    // Use agent to maintain cookies across requests
    agent = request.agent(app);
  });

  describe("POST /api/v1/auth/register", () => {
    it("should register a new admin if super admin", async () => {
      // Create a super admin first
      const superAdmin = await Admin.create({
        name: "Super Admin",
        email: "super@test.com",
        password: "Password@123",
        role: "Super Admin",
      });

      // Get CSRF token
      let csrfRes = await agent.get("/api/v1/auth/csrf-token");
      let csrfToken = csrfRes.body.csrfToken;

      const loginRes = await agent
        .post("/api/v1/auth/login")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: "super@test.com",
          password: "Password@123",
        });

      const token = loginRes.body.token;

      // Get new CSRF token for register request
      csrfRes = await agent.get("/api/v1/auth/csrf-token");
      csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .post("/api/v1/auth/register")
        .set("Authorization", `Bearer ${token}`)
        .set("X-CSRF-Token", csrfToken)
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
      // Get CSRF token
      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .post("/api/v1/auth/register")
        .set("X-CSRF-Token", csrfToken)
        .send({
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

      let csrfRes = await agent.get("/api/v1/auth/csrf-token");
      let csrfToken = csrfRes.body.csrfToken;

      const loginRes = await agent
        .post("/api/v1/auth/login")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: "admin@test.com",
          password: "Password@123",
        });

      const token = loginRes.body.token;

      csrfRes = await agent.get("/api/v1/auth/csrf-token");
      csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .post("/api/v1/auth/register")
        .set("Authorization", `Bearer ${token}`)
        .set("X-CSRF-Token", csrfToken)
        .send({
          name: "Another Admin",
          email: "another@test.com",
          password: "Password@123",
        });

      expect(res.status).toBe(403);
    });

    it("should prioritize Authorization header token over cookie token", async () => {
      await Admin.create({
        name: "Super Admin",
        email: "super@test.com",
        password: "Password@123",
        role: "Super Admin",
      });

      await Admin.create({
        name: "Regular Admin",
        email: "admin@test.com",
        password: "Password@123",
        role: "Admin",
      });

      // Login as super admin on the main agent to set super-admin cookie
      let csrfRes = await agent.get("/api/v1/auth/csrf-token");
      let csrfToken = csrfRes.body.csrfToken;

      await agent
        .post("/api/v1/auth/login")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: "super@test.com",
          password: "Password@123",
        });

      // Login as regular admin in a separate agent to get regular-admin bearer token
      const adminAgent = request.agent(app);
      csrfRes = await adminAgent.get("/api/v1/auth/csrf-token");
      csrfToken = csrfRes.body.csrfToken;

      const adminLoginRes = await adminAgent
        .post("/api/v1/auth/login")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: "admin@test.com",
          password: "Password@123",
        });

      const regularAdminToken = adminLoginRes.body.token;

      // Use super-admin cookie + regular-admin bearer token together.
      // Authorization header must take precedence, so this should be forbidden.
      csrfRes = await agent.get("/api/v1/auth/csrf-token");
      csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .post("/api/v1/auth/register")
        .set("Authorization", `Bearer ${regularAdminToken}`)
        .set("X-CSRF-Token", csrfToken)
        .send({
          name: "Should Not Be Created",
          email: "blocked@test.com",
          password: "Password@123",
          role: "Admin",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should login with valid credentials", async () => {
      await Admin.create({
        name: "Admin",
        email: "admin@test.com",
        password: "Password@123",
      });

      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .post("/api/v1/auth/login")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: "admin@test.com",
          password: "Password@123",
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
    });

    it("should fail with invalid credentials", async () => {
      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .post("/api/v1/auth/login")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: "nonexistent@test.com",
          password: "Password@123",
        });

      expect(res.status).toBe(401);
    });
  });
});
