jest.mock("../services/emailService", () => ({
  generateOTP: jest.fn(() => "123456"),
  sendOTPEmail: jest.fn().mockResolvedValue(undefined),
  sendAdminInviteEmail: jest.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
}));

const request = require("supertest");
const app = require("../app");
const Admin = require("../Models/Admin");
const Otp = require("../Models/Otp");

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
          email: "admin@test.com",
          role: "Admin",
        });

      expect(res.status).toBe(201);
      expect(res.body.admin.email).toBe("admin@test.com");
      expect(res.body.admin.activation_required).toBe(true);
      expect(res.body.admin.is_password_set).toBe(false);
    });

    it("should fail if not authorized", async () => {
      // Get CSRF token
      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .post("/api/v1/auth/register")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: "admin@test.com",
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
          email: "another@test.com",
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
          email: "blocked@test.com",
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

    it("should block login when account activation is pending", async () => {
      await Admin.create({
        name: "Pending Admin",
        email: "pending@test.com",
        password: "Password@123",
        role: "Admin",
        activation_required: true,
        is_password_set: false,
      });

      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .post("/api/v1/auth/login")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: "pending@test.com",
          password: "Password@123",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ACTIVATION_REQUIRED");
      expect(res.body.activationRequired).toBe(true);
    });
  });

  describe("POST /api/v1/auth/activate-admin", () => {
    it("should activate invited admin with valid OTP", async () => {
      await Admin.create({
        name: "Pending Admin",
        email: "invitee@test.com",
        password: "Password@123",
        role: "Admin",
        activation_required: true,
        is_password_set: false,
      });

      await Otp.create({
        email: "invitee@test.com",
        otp: "123456",
        purpose: "admin-activation",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .post("/api/v1/auth/activate-admin")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: "invitee@test.com",
          name: "Invited Admin",
          otp: "123456",
          newPassword: "NewPass@123",
          confirmPassword: "NewPass@123",
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body.activation_required).toBe(false);

      const activatedAdmin = await Admin.findOne({ email: "invitee@test.com" });
      expect(activatedAdmin.name).toBe("Invited Admin");
      expect(activatedAdmin.activation_required).toBe(false);
      expect(activatedAdmin.is_password_set).toBe(true);
    });
  });
});
