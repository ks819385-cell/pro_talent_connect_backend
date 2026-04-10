const request = require("supertest");
const app = require("../app");
const Admin = require("../Models/Admin");
const Otp = require("../Models/Otp");

describe("Admin Management API", () => {
  let agent;

  const loginAndGetToken = async (email, password) => {
    const csrfRes = await agent.get("/api/v1/auth/csrf-token");
    const csrfToken = csrfRes.body.csrfToken;

    const loginRes = await agent
      .post("/api/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email, password });

    return loginRes.body.token;
  };

  const createPendingInvite = async ({ email = "invitee@test.com", role = "Admin" } = {}) => {
    const pendingAdmin = await Admin.create({
      name: "Pending Admin",
      email,
      password: "Password@123",
      role,
      activation_required: true,
      is_password_set: false,
      invited_at: new Date(),
    });

    await Otp.create({
      email,
      otp: "123456",
      purpose: "admin-activation",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    return pendingAdmin;
  };

  beforeEach(async () => {
    agent = request.agent(app);
  });

  describe("PATCH /api/v1/admins/:id/withdraw-invite", () => {
    it("should withdraw a pending invite and delete activation OTP", async () => {
      await Admin.create({
        name: "Super Admin",
        email: "super@test.com",
        password: "Password@123",
        role: "Super Admin",
      });

      const pendingAdmin = await createPendingInvite();
      const token = await loginAndGetToken("super@test.com", "Password@123");

      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .patch(`/api/v1/admins/${pendingAdmin._id}/withdraw-invite`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-CSRF-Token", csrfToken)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Invite withdrawn successfully");

      const deletedAdmin = await Admin.findById(pendingAdmin._id);
      expect(deletedAdmin).toBeNull();

      const otpRecord = await Otp.findOne({
        email: "invitee@test.com",
        purpose: "admin-activation",
      });
      expect(otpRecord).toBeNull();
    });

    it("should fail when invite is not pending", async () => {
      await Admin.create({
        name: "Super Admin",
        email: "super@test.com",
        password: "Password@123",
        role: "Super Admin",
      });

      const activeAdmin = await Admin.create({
        name: "Active Admin",
        email: "active@test.com",
        password: "Password@123",
        role: "Admin",
        activation_required: false,
        is_password_set: true,
      });

      const token = await loginAndGetToken("super@test.com", "Password@123");

      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .patch(`/api/v1/admins/${activeAdmin._id}/withdraw-invite`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-CSRF-Token", csrfToken)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Only pending invites can be withdrawn");
    });

    it("should fail when super admin tries to withdraw own invite", async () => {
      const superAdmin = await Admin.create({
        name: "Super Admin",
        email: "super@test.com",
        password: "Password@123",
        role: "Super Admin",
      });

      const token = await loginAndGetToken("super@test.com", "Password@123");

      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .patch(`/api/v1/admins/${superAdmin._id}/withdraw-invite`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-CSRF-Token", csrfToken)
        .send();

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Cannot withdraw your own account invite");
    });

    it("should deny non-super-admin users", async () => {
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

      const pendingAdmin = await createPendingInvite({ email: "pending2@test.com" });
      const token = await loginAndGetToken("admin@test.com", "Password@123");

      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .patch(`/api/v1/admins/${pendingAdmin._id}/withdraw-invite`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-CSRF-Token", csrfToken)
        .send();

      expect(res.status).toBe(403);
    });
  });
});