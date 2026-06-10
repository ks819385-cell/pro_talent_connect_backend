const request = require("supertest");
const app = require("../app");
const Admin = require("../Models/Admin");
const fs = require("fs");
const path = require("path");

describe("Profile Image Upload API", () => {
  let adminToken;
  let agent;

  beforeEach(async () => {
    const request_module = require("supertest");
    agent = request_module.agent(app);

    // Setup Admin
    await Admin.create({
      name: "Admin",
      email: "admin_upload@test.com",
      password: "Password@123",
      role: "Admin",
    });

    // Get CSRF token
    const csrfRes = await agent.get("/api/v1/auth/csrf-token");
    const csrfToken = csrfRes.body.csrfToken;

    // Login
    const loginRes = await agent
      .post("/api/v1/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({
        email: "admin_upload@test.com",
        password: "Password@123",
      });
    adminToken = loginRes.body.token;
  });

  describe("POST /api/v1/upload/profile-image", () => {
    it("should fail if unauthorized (no token)", async () => {
      const freshAgent = request.agent(app);
      const csrfRes = await freshAgent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await freshAgent
        .post("/api/v1/upload/profile-image")
        .set("X-CSRF-Token", csrfToken);
      expect(res.status).toBe(401);
    });

    it("should fail if no file is uploaded", async () => {
      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const res = await agent
        .post("/api/v1/upload/profile-image")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-CSRF-Token", csrfToken);
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("No image file provided");
    });

    it("should reject invalid file signatures (magic bytes)", async () => {
      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      const fakeBuffer = Buffer.from("this is a text file and not an image signature");

      const res = await agent
        .post("/api/v1/upload/profile-image")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-CSRF-Token", csrfToken)
        .attach("profileImage", fakeBuffer, "image.png");

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid file signature");
    });

    it("should accept valid images and return a public url", async () => {
      const csrfRes = await agent.get("/api/v1/auth/csrf-token");
      const csrfToken = csrfRes.body.csrfToken;

      // Construct a valid PNG buffer: 89 50 4E 47 0D 0A 1A 0A followed by minimum PNG structure (blank png)
      const validPngHeader = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
        0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
        0x42, 0x60, 0x82
      ]);

      const res = await agent
        .post("/api/v1/upload/profile-image")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-CSRF-Token", csrfToken)
        .attach("profileImage", validPngHeader, "test_avatar.png");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.profile_image_url).toContain("/public/uploads/players/");

      // Clean up the uploaded file from public directory
      const urlParts = res.body.profile_image_url.split("/");
      const filename = urlParts[urlParts.length - 1];
      const filePath = path.join(__dirname, "..", "public", "uploads", "players", filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });
});
