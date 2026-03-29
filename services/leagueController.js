const League = require("../Models/League");
const { AppError, catchAsync } = require("../Middleware/errorHandler");
const { logAction } = require("../Middleware/auditLogger");

const DEFAULT_LEAGUES = [
  { name: "Indian Super League",     tier: "Tier 1"    },
  { name: "I-League",                tier: "Tier 2"    },
  { name: "I-League 2",              tier: "Tier 3"    },
  { name: "I-League 3",              tier: "Tier 4"    },
  { name: "Calcutta Football League", tier: "State Tier" },
  { name: "Kerala Premier League",   tier: "State Tier" },
  { name: "Goa Professional League", tier: "State Tier" },
  { name: "Bangalore Super Division", tier: "State Tier" },
  { name: "Delhi Premier League",    tier: "State Tier" },
  { name: "Mumbai Premier League",   tier: "State Tier" },
  { name: "Mizoram Premier League",  tier: "State Tier" },
  { name: "Manipur State League",    tier: "State Tier" },
  { name: "Punjab State Super League", tier: "State Tier" },
];

// Seed default leagues once — called on server start
const seedLeagues = async () => {
  try {
    const count = await League.countDocuments();
    if (count === 0) {
      await League.insertMany(DEFAULT_LEAGUES);
      console.log("✅ Default leagues seeded");
    }
  } catch (err) {
    console.error("League seed error:", err.message);
  }
};

// @route GET /api/leagues
// @access Public
const getLeagues = catchAsync(async (req, res) => {
  const leagues = await League.find().sort({ tier: 1, name: 1 });
  res.status(200).json(leagues);
});

// @route POST /api/leagues
// @access Admin+
const createLeague = catchAsync(async (req, res) => {
  const { name, tier } = req.body;
  if (!name || !tier) throw new AppError("Name and tier are required", 400);

  const existing = await League.findOne({
    name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
  });
  if (existing) throw new AppError("A league with this name already exists", 400);

  const league = await League.create({ name: name.trim(), tier });

  await logAction({
    user: req.user,
    action: "CREATE",
    resourceType: "League",
    resourceId: league._id.toString(),
    description: `League created: ${league.name} (${league.tier})`,
    req,
    status: "SUCCESS",
  });

  res.status(201).json(league);
});

// @route PUT /api/leagues/:id
// @access Admin+
const updateLeague = catchAsync(async (req, res) => {
  const league = await League.findById(req.params.id);
  if (!league) throw new AppError("League not found", 404);

  const { name, tier, active } = req.body;
  if (name !== undefined) league.name = name.trim();
  if (tier !== undefined) league.tier = tier;
  if (active !== undefined) league.active = active;

  await league.save();

  await logAction({
    user: req.user,
    action: "UPDATE",
    resourceType: "League",
    resourceId: league._id.toString(),
    description: `League updated: ${league.name}`,
    req,
    status: "SUCCESS",
  });

  res.status(200).json(league);
});

// @route DELETE /api/leagues/:id
// @access Admin+
const deleteLeague = catchAsync(async (req, res) => {
  const league = await League.findByIdAndDelete(req.params.id);
  if (!league) throw new AppError("League not found", 404);

  await logAction({
    user: req.user,
    action: "DELETE",
    resourceType: "League",
    resourceId: req.params.id,
    description: `League deleted: ${league.name}`,
    req,
    status: "SUCCESS",
  });

  res.status(200).json({ message: "League deleted successfully" });
});

module.exports = { getLeagues, createLeague, updateLeague, deleteLeague, seedLeagues };
