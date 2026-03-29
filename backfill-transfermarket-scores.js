require("dotenv").config();
const mongoose = require("mongoose");
const Player = require("./Models/Players");
const { calculateScoutReport } = require("./services/scoutReportCalculator");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const filter = {
    isDeleted: { $ne: true },
    transferMarketLink: { $type: "string", $regex: /\S/ },
  };

  const players = await Player.find(filter, {
    age: 1,
    height: 1,
    weight: 1,
    playingPosition: 1,
    transferMarketLink: 1,
    competitions: 1,
    currentLeague: 1,
    stateLeague: 1,
    clubTier: 1,
    clubsPlayed: 1,
    sprint30m: 1,
    mentalityScore: 1,
    scoutReport: 1,
    name: 1,
  });

  let changed = 0;
  let transferMarketAwarded = 0;
  const ops = [];

  for (const player of players) {
    const newScoutReport = calculateScoutReport({
      age: player.age,
      height: player.height,
      weight: player.weight,
      playingPosition: player.playingPosition,
      transferMarketLink: player.transferMarketLink,
      competitions: player.competitions,
      currentLeague: player.currentLeague,
      stateLeague: player.stateLeague,
      clubTier: player.clubTier,
      clubsPlayed: player.clubsPlayed,
      sprint30m: player.sprint30m,
      mentalityScore: player.mentalityScore,
    });

    const oldTransferMarketScore = Number(player.scoutReport?.transferMarketScore || 0);
    const oldTotalScore = Number(player.scoutReport?.totalScore || 0);

    if (
      oldTransferMarketScore !== Number(newScoutReport.transferMarketScore || 0) ||
      oldTotalScore !== Number(newScoutReport.totalScore || 0) ||
      (player.scoutReport?.grade || "") !== (newScoutReport.grade || "")
    ) {
      changed++;
      if (newScoutReport.transferMarketScore > 0) transferMarketAwarded++;
      ops.push({
        updateOne: {
          filter: { _id: player._id },
          update: { $set: { scoutReport: newScoutReport } },
        },
      });
    }
  }

  if (ops.length > 0) {
    await Player.bulkWrite(ops, { ordered: false });
  }

  const miraj = await Player.findOne({ name: /^miraj mullick$/i }, { name: 1, transferMarketLink: 1, scoutReport: 1 }).lean();

  console.log("Backfill complete");
  console.log(`Players with transfer links scanned: ${players.length}`);
  console.log(`Players updated: ${changed}`);
  console.log(`Players newly awarded transferMarketScore: ${transferMarketAwarded}`);
  if (miraj) {
    console.log("Miraj snapshot:");
    console.log(
      JSON.stringify(
        {
          name: miraj.name,
          transferMarketLink: miraj.transferMarketLink,
          transferMarketScore: miraj.scoutReport?.transferMarketScore,
          totalScore: miraj.scoutReport?.totalScore,
          grade: miraj.scoutReport?.grade,
        },
        null,
        2,
      ),
    );
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Backfill failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
