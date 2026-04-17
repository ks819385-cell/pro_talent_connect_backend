const request = require("supertest");
const app = require("../app");
const Admin = require("../Models/Admin");

const SAMPLE_PARTNERS = [
  {
    id: "partner-1",
    name: "Alpha Scout Group",
    type: "Scouting Agency",
    description: "Regional scouting partner for youth football events.",
    avatar: "ASG",
    logoUrl: "",
    avatarColor: "from-red-500/30 to-red-900/30",
    borderColor: "border-red-500/20",
    accentColor: "text-red-400",
    social: {
      instagram: {
        handle: "@alphascoutgroup",
        url: "https://instagram.com/alphascoutgroup",
      },
    },
  },
];

describe("About Partners API", () => {
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

  beforeEach(async () => {
    agent = request.agent(app);
  });

  it("should return partners list on public endpoint", async () => {
    const res = await agent.get("/api/v1/about/partners");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.partners)).toBe(true);
  });

  it("should allow super admin to replace partners list", async () => {
    await Admin.create({
      name: "Super Admin",
      email: "super@test.com",
      password: "Password@123",
      role: "Super Admin",
    });

    const token = await loginAndGetToken("super@test.com", "Password@123");

    const csrfRes = await agent.get("/api/v1/auth/csrf-token");
    const csrfToken = csrfRes.body.csrfToken;

    const updateRes = await agent
      .put("/api/v1/about/partners")
      .set("Authorization", `Bearer ${token}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ partners: SAMPLE_PARTNERS });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.partners).toHaveLength(1);
    expect(updateRes.body.partners[0].name).toBe("Alpha Scout Group");

    const getRes = await agent.get("/api/v1/about/partners");
    expect(getRes.status).toBe(200);
    expect(getRes.body.partners).toHaveLength(1);
    expect(getRes.body.partners[0].type).toBe("Scouting Agency");
  });

  it("should reject partner updates from non-super-admin", async () => {
    await Admin.create({
      name: "Regular Admin",
      email: "admin@test.com",
      password: "Password@123",
      role: "Admin",
    });

    const token = await loginAndGetToken("admin@test.com", "Password@123");

    const csrfRes = await agent.get("/api/v1/auth/csrf-token");
    const csrfToken = csrfRes.body.csrfToken;

    const res = await agent
      .put("/api/v1/about/partners")
      .set("Authorization", `Bearer ${token}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ partners: SAMPLE_PARTNERS });

    expect(res.status).toBe(403);
  });

  it("should validate request body when partners is not an array", async () => {
    await Admin.create({
      name: "Super Admin",
      email: "super2@test.com",
      password: "Password@123",
      role: "Super Admin",
    });

    const token = await loginAndGetToken("super2@test.com", "Password@123");

    const csrfRes = await agent.get("/api/v1/auth/csrf-token");
    const csrfToken = csrfRes.body.csrfToken;

    const res = await agent
      .put("/api/v1/about/partners")
      .set("Authorization", `Bearer ${token}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ partners: { invalid: true } });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("array");
  });
});
