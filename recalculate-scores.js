/**
 * Recalculate Scout Report Scores for All Players
 * Useful after updating the scoring calculator
 * 
 * Usage: node recalculate-scores.js
 */

require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const path = require("path");

// Import models and calculator
const Player = require("./Models/Players");
const { calculateScoutReport } = require("./services/scoutReportCalculator");

async function recalculateAllScores() {
  try {
    // Connect to MongoDB
    const mongoUrl = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/protalent";
    console.log(`Connecting to MongoDB...`);
    console.log(`Using connection: ${mongoUrl ? mongoUrl.substring(0, 50) + '...' : 'default localhost'}`);
    
    await mongoose.connect(mongoUrl);
    console.log("✓ Connected to MongoDB\n");

    // Fetch all active players (not soft-deleted)
    const players = await Player.find({ isDeleted: { $ne: true } }).lean();
    console.log(`Found ${players.length} active players\n`);

    let updated = 0;
    let unchanged = 0;
    let errors = 0;
    const updatedPlayers = [];

    // Recalculate scores for each player
    for (let i = 0; i < players.length; i++) {
      try {
        const player = players[i];
        
        // Calculate new scout report
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

        // Check if score changed
        const oldScore = player.scoutReport?.totalScore ?? 0;
        const newScore = newScoutReport.totalScore;
        const oldGrade = player.scoutReport?.grade ?? "N/A";
        const newGrade = newScoutReport.grade;

        if (oldScore !== newScore || oldGrade !== newGrade) {
          // Update in database
          await Player.findByIdAndUpdate(player._id, {
            scoutReport: newScoutReport,
          });
          
          updated++;
          updatedPlayers.push({
            name: player.name,
            oldScore: `${oldScore} (${oldGrade})`,
            newScore: `${newScore} (${newGrade})`,
          });
        } else {
          unchanged++;
        }
      } catch (err) {
        errors++;
        console.error(`Error processing player ${i + 1}:`, err.message);
      }

      // Progress indicator
      if ((i + 1) % 50 === 0) {
        console.log(`  Processed ${i + 1}/${players.length}...`);
      }
    }

    // Print summary
    console.log("\n" + "=".repeat(80));
    console.log("RECALCULATION SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total players processed: ${players.length}`);
    console.log(`Scores updated: ${updated}`);
    console.log(`Scores unchanged: ${unchanged}`);
    console.log(`Errors: ${errors}\n`);

    if (updatedPlayers.length > 0) {
      console.log("PLAYERS WITH UPDATED SCORES:");
      console.log("-".repeat(80));
      updatedPlayers.forEach((p) => {
        console.log(`${p.name}`);
        console.log(`  Before: ${p.oldScore} → After: ${p.newScore}`);
      });
    }

    console.log("\n✓ Recalculation complete!");
    process.exit(0);
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the recalculation
recalculateAllScores();
