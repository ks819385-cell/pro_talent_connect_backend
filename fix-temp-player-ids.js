require("dotenv").config();
const mongoose = require("mongoose");
const Player = require("./Models/Players");

const MISSING_ID_LABEL = "Player Has No ID";

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set in .env");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const indexes = await Player.collection.indexes();
  const playerIdIndex = indexes.find((index) => index.name === "playerId_1" && index.unique);
  if (playerIdIndex) {
    await Player.collection.dropIndex("playerId_1");
    console.log("Dropped unique playerId index.");
  }

  const players = await Player.find(
    {
      isDeleted: { $ne: true },
      $or: [
        { playerId: { $regex: /^PL_TEMP_/ } },
        { playerId: { $regex: /^Player Has No ID \(/ } },
      ],
    },
    { _id: 1, playerId: 1, name: 1, scoutReport: 1, plId: 1 },
  ).lean();

  if (players.length === 0) {
    console.log("No players found with legacy temp IDs.");
    await mongoose.disconnect();
    return;
  }

  const ops = players.map((player) => ({
    updateOne: {
      filter: { _id: player._id },
      update: {
        $set: {
          playerId: MISSING_ID_LABEL,
          plId: MISSING_ID_LABEL,
          "scoutReport.grade": "INCOMPLETE",
        },
      },
    },
  }));

  const result = await Player.bulkWrite(ops, { ordered: false });

  console.log("Temp player ID fix complete.");
  console.log(`Matched players: ${players.length}`);
  console.log(`Modified players: ${result.modifiedCount || 0}`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Temp player ID fix failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
