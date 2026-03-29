/**
 * Import Players from CSV into MongoDB
 * - First run: inserts new players, skips existing ones
 * - With --update flag: updates existing players' competitions & scores
 * 
 * Usage:
 *   node import-players-csv.js            # insert new only
 *   node import-players-csv.js --update   # update competitions & scores for ALL CSV players
 * 
 * Requires: .env with MONGO_URI set
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const mongoose = require("mongoose");
const Player = require("./Models/Players");
const { calculateScoutReport } = require("./services/scoutReportCalculator");

const CSV_PATH = path.join(__dirname, "..", "CRM Master Player Database of 75 Players - Copy.csv");
const UPDATE_MODE = process.argv.includes("--update");

// ─── Helpers ───

function parseDate(dateStr) {
  if (!dateStr || dateStr === "N/A") return null;
  // Format: "13-Sep-2003" or similar
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function getAgeGroup(age) {
  if (age <= 13) return "U13";
  if (age <= 15) return "U15";
  if (age <= 17) return "U17";
  if (age <= 19) return "U19";
  return "Senior";
}

function extractStateAndNationality(placeOfBirth) {
  if (!placeOfBirth) return { state: "", nationality: "" };
  // Format: "Assam, IND" or "West Bengal, IND"
  const parts = placeOfBirth.split(",").map((s) => s.trim());
  const state = parts[0] || "";
  const rawCountry = parts[1] || "";
  const nationality = rawCountry === "IND" ? "Indian" : rawCountry;
  return { state, nationality };
}

function parseClubsPlayed(previousClubs, currentClub) {
  const clubs = [];

  // Parse previous clubs
  if (previousClubs) {
    const lines = previousClubs.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const match = line.match(/^(.+?)\s*\((\d{4}(?:-\d{4})?)\)\s*$/);
      if (match) {
        clubs.push({ clubName: match[1].trim(), duration: match[2].trim() });
      } else {
        clubs.push({ clubName: line.trim(), duration: "" });
      }
    }
  }

  // Add current club if not already in list
  if (currentClub && currentClub !== "Free Agent") {
    const alreadyListed = clubs.some(
      (c) => c.clubName.toLowerCase() === currentClub.toLowerCase()
    );
    if (!alreadyListed) {
      clubs.push({ clubName: currentClub.trim(), duration: "Present" });
    }
  }

  return clubs;
}

function parsePosition(positionStr) {
  if (!positionStr) return { primary: "", alternative: "" };
  const parts = positionStr.split("/").map((s) => s.trim());
  return {
    primary: parts[0],
    alternative: parts.length > 1 ? parts.slice(1).join("/") : "",
  };
}

function generatePlayerId() {
  // Generate a temporary unique player ID for players without one
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `PL_TEMP_${rand}_${Date.now()}`;
}

// ─── Competition Type Auto-Detection ───

const COMP_TYPE_PATTERNS = [
  // Order matters — more specific patterns first
  { pattern: /\bnational\s*team\b|india[n]?\s*(u-?\d+\s*)?national\s*team\s*camp|saff\s*cup|asia\s*cup/i, type: "National Team" },
  { pattern: /\bi-?league\s*(senior|1st|first)\b|i-?league(?!\s*(2|3|qualif|second|third|u-?\d))(?=\s|$)/i, type: "I-League Senior" },
  { pattern: /\bi-?league\s*(2|2nd|second|qualif)\b|2nd\s*div(ision)?\s*i[\s-]*league/i, type: "I-League 2" },
  { pattern: /\bi-?league\s*(3|3rd|third)\b/i, type: "I-League 3" },
  { pattern: /\bisl\b|indian\s*super\s*league|state\s*franchise\s*league/i, type: "State Franchise League" },
  { pattern: /\bsantosh\s*trophy/i, type: "Santosh Trophy" },
  { pattern: /\bnational\s*(football|fc|school)?\s*champion|bc\s*roy\s*trophy\s*national|subroto\s*cup\s*national|sub\s*junior.*national|junior\s*national|national.*games.*u-?\d|sgfi\s*national|khelo\s*india|swami\s*vivekananda.*national|all\s*india\s*university\s*game/i, type: "National Youth Championships" },
  { pattern: /\b(england|spain|japan|laliga|premier\s*league\s*next\s*gen|sanix\s*cup|arsenal\s*cup.*emirates|youth\s*premier\s*league.*england|foreign)/i, type: "Foreign Exposure" },
  { pattern: /\belite\s*youth\s*i[\s-]*league/i, type: "Elite Youth I-League" },
  { pattern: /\brfdl\b|reliance\s*(foundation\s*)?(dev(elopment)?\s*)?league|reliance\s*foundation\s*dev/i, type: "RFDL" },
  { pattern: /\bstate\s*(youth|u-?\d)\s*league|state\s*youth\s*league/i, type: "State Youth League" },
  { pattern: /\bpremier\s*(division\s*)?league|state\s*league|state\s*premier|assam\s*(premier|state)\s*league|manipur\s*state\s*premier|kerala\s*premier\s*league|goa\s*pro\s*league|nagaland\s*super\s*league|calcutta\s*premier|cfl\s*premier|delhi\s*premier|gujarat\s*state\s*senior|maharashtra\s*state\s*league|madhya\s*pradesh\s*premier|rajasthan\s*state\s*league|uttrakhand\s*premier|bdfa\s*super|urbanise\s*bdfa|super\s*division/i, type: "State League" },
  { pattern: /\bdistrict\s*(league|football|championship)|cfl\s*(1st|2nd|3rd|4th|5th)\s*div|a\s*division\s*league|b\s*division\s*league|c\s*division|ifa\s*(shield|nursery)|subroto\s*cup\s*state|reliance\s*cup\s*(state|school|college|u-?\d)|inter\s*(college|district|university)/i, type: "District League" },
];

function detectCompetitionType(compName) {
  if (!compName) return "Other";
  for (const { pattern, type } of COMP_TYPE_PATTERNS) {
    if (pattern.test(compName)) return type;
  }
  return "Other";
}

function detectResult(compName) {
  if (!compName) return "";
  if (/\bchampion(s)?\b/i.test(compName) && !/\bchampionship\b/i.test(compName.replace(/champion(s)?\b/gi, ""))) {
    // "Champions" but not just "Championship"
    if (/\bchampion(s)?\b/i.test(compName)) return "Champion";
  }
  if (/\bchampions?\b/i.test(compName) && !/\bchampionship\b/i.test(compName)) return "Champion";
  // Check "Champion" appears as result, not in "Championship" context
  const cleaned = compName.replace(/championship/gi, "");
  if (/\bchampion(s)?\b/i.test(cleaned)) return "Champion";
  if (/\brunner(s)?[\s-]*up\b/i.test(compName)) return "Runner-up";
  if (/\b(3rd|third)\s*place\b/i.test(compName)) return "Third";
  return "Participant";
}

function extractYear(compName) {
  // Look for year patterns like (2024), 2023-24, 2024/25
  const match = compName.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1]) : null;
}

function parseCompetitions(leaguesPlayed) {
  if (!leaguesPlayed || !leaguesPlayed.trim()) return [];

  const lines = leaguesPlayed.split("\n").filter((l) => l.trim());
  const competitions = [];

  for (const line of lines) {
    const name = line.trim();
    if (!name) continue;

    const type = detectCompetitionType(name);
    const result = detectResult(name);
    const year = extractYear(name);

    competitions.push({
      name,
      type,
      year,
      result,
    });
  }

  return competitions;
}

function detectStateLeague(leaguesPlayed, currentClub) {
  if (!leaguesPlayed) return "";
  const text = leaguesPlayed.toLowerCase();
  // Check for known state leagues
  const stateLeagues = [
    { match: /cfl\s*premier/i, name: "Calcutta Football League" },
    { match: /calcutta\s*premier/i, name: "Calcutta Football League" },
    { match: /mizoram\s*premier/i, name: "Mizoram Premier League" },
    { match: /goa\s*pro\s*league/i, name: "Goa Professional League" },
    { match: /kerala\s*premier/i, name: "Kerala Premier League" },
    { match: /delhi\s*premier/i, name: "Delhi Premier League" },
    { match: /assam\s*premier/i, name: "Assam Premier League" },
    { match: /manipur\s*state\s*premier/i, name: "Manipur State League" },
    { match: /bdfa\s*super|urbanise\s*bdfa/i, name: "Bangalore Super Division" },
    { match: /nagaland\s*super/i, name: "State League" },
    { match: /punjab\s*state\s*super/i, name: "Punjab State Super League" },
  ];

  for (const { match, name } of stateLeagues) {
    if (match.test(leaguesPlayed)) return name;
  }
  return "";
}

// ─── Main ───

async function importPlayers() {
  // 1) Read and parse the CSV
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ CSV file not found: ${CSV_PATH}`);
    process.exit(1);
  }

  const rawCsv = fs.readFileSync(CSV_PATH, "utf-8");

  // The CSV has 2 header/title rows before the actual column headers (row 3)
  const lines = rawCsv.split("\n");
  // Find the header row (starts with "S.No")
  let headerIndex = -1;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (lines[i].startsWith("S.No")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    console.error("❌ Could not find header row in CSV");
    process.exit(1);
  }

  // Re-join from header row onward
  const csvContent = lines.slice(headerIndex).join("\n");

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  console.log(`📄 Parsed ${records.length} player records from CSV\n`);

  // 2) Connect to MongoDB
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI not set in .env file");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  // 3) Get all existing player emails for duplicate check
  const existingPlayers = await Player.find(
    { isDeleted: { $ne: true } },
    { email: 1, playerId: 1, name: 1, _id: 1 }
  ).lean();

  const existingEmailMap = new Map(existingPlayers.map((p) => [p.email?.toLowerCase(), p]));
  const existingPlayerIds = new Set(existingPlayers.map((p) => p.playerId));

  console.log(`📊 Found ${existingPlayers.length} existing players in database`);
  console.log(`🔄 Mode: ${UPDATE_MODE ? "UPDATE competitions & scores" : "INSERT new players only"}`);
  console.log(`─────────────────────────────────────────\n`);

  // 4) Process each CSV record
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const skippedPlayers = [];
  const addedPlayers = [];
  const updatedPlayers = [];
  const errorPlayers = [];

  for (const row of records) {
    const name = row["Name"]?.trim();
    const email = row["Email"]?.trim()?.toLowerCase();
    const rawPlayerId = row["Player ID"]?.trim();

    if (!name || !email) {
      console.log(`⚠️  Skipping row - missing name or email`);
      errors++;
      continue;
    }

    // Parse competitions from "Leagues Played" column
    const competitions = parseCompetitions(row["Leagues Played"]);
    const stateLeague = detectStateLeague(row["Leagues Played"], row["Current Club"]);

    // Map CSV fields to Player model
    const { primary, alternative } = parsePosition(row["Position"]);
    const { state, nationality } = extractStateAndNationality(row["Place of Birth"]);
    const playerId = rawPlayerId && rawPlayerId !== "N/A" ? rawPlayerId : generatePlayerId();
    const dob = parseDate(row["Date of Birth"]);
    const age = parseInt(row["Age"]) || null;
    const height = parseInt(row["Height (cms)"]) || undefined;
    const weight = parseInt(row["Weight (kg)"]) || undefined;
    const clubsPlayed = parseClubsPlayed(row["Previous Clubs"], row["Current Club"]);
    const transferMarketLink = row["Transfer Market Link"]?.trim() || "";

    // Check if player already exists
    const existingPlayer = existingEmailMap.get(email);

    if (existingPlayer && UPDATE_MODE) {
      // UPDATE MODE: update competitions, stateLeague, and recalc scout report
      try {
        const scoutReport = calculateScoutReport({
          age,
          height,
          weight,
          playingPosition: primary,
          transferMarketLink,
          competitions,
          currentLeague: row["Current Club"]?.trim() || "",
          stateLeague,
          clubsPlayed,
        });

        await Player.updateOne(
          { _id: existingPlayer._id },
          {
            $set: {
              competitions,
              stateLeague,
              scoutReport,
              career_history: [
                row["Previous Clubs"] ? `Previous Clubs:\n${row["Previous Clubs"]}` : "",
                row["Leagues Played"] ? `\nLeagues Played:\n${row["Leagues Played"]}` : "",
              ].filter(Boolean).join("\n"),
              clubsPlayed,
            },
          }
        );

        updatedPlayers.push(`${name} — Score: ${scoutReport.totalScore} (${scoutReport.grade}) | ${competitions.length} competitions`);
        updated++;
      } catch (err) {
        errorPlayers.push(`${name} (update): ${err.message}`);
        errors++;
      }
      continue;
    }

    if (existingPlayer) {
      skippedPlayers.push(`${name} (${email})`);
      skipped++;
      continue;
    }

    // Also check by playerId if not N/A
    if (rawPlayerId && rawPlayerId !== "N/A" && existingPlayerIds.has(rawPlayerId)) {
      skippedPlayers.push(`${name} (${rawPlayerId})`);
      skipped++;
      continue;
    }

    // Calculate scout report
    const scoutReport = calculateScoutReport({
      age,
      height,
      weight,
      playingPosition: primary,
      transferMarketLink,
      competitions,
      currentLeague: row["Current Club"]?.trim() || "",
      stateLeague,
      clubsPlayed,
    });

    const playerData = {
      name,
      email,
      playerId,
      dateOfBirth: dob,
      age: age,
      age_group: age ? getAgeGroup(age) : "Senior",
      playingPosition: primary || "Unknown",
      alternativePosition: alternative,
      height,
      weight,
      gender: row["Gender"]?.trim() || "Male",
      state,
      nationality,
      mobileNumber: row["Contact Number"]?.trim() || "N/A",
      currentLeague: row["Current Club"]?.trim() || "",
      stateLeague,
      career_history: [
        row["Previous Clubs"] ? `Previous Clubs:\n${row["Previous Clubs"]}` : "",
        row["Leagues Played"] ? `\nLeagues Played:\n${row["Leagues Played"]}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      competitions,
      clubsPlayed,
      transferMarketLink,
      plId: rawPlayerId && rawPlayerId !== "N/A" ? rawPlayerId : "",
      scoutReport,
    };

    try {
      await Player.create(playerData);
      addedPlayers.push(`${name} — Score: ${scoutReport.totalScore} (${scoutReport.grade}) | ${competitions.length} competitions`);
      added++;
    } catch (err) {
      errorPlayers.push(`${name}: ${err.message}`);
      errors++;
    }
  }

  // 5) Print summary
  console.log(`\n═══════════════════════════════════════`);
  console.log(`           IMPORT SUMMARY`);
  console.log(`═══════════════════════════════════════`);
  console.log(`✅ Added:   ${added} new players`);
  if (UPDATE_MODE) console.log(`🔄 Updated: ${updated} existing players`);
  console.log(`⏭️  Skipped: ${skipped} existing players`);
  console.log(`❌ Errors:  ${errors}`);
  console.log(`───────────────────────────────────────`);

  if (addedPlayers.length > 0) {
    console.log(`\n🆕 New players added:`);
    addedPlayers.forEach((p) => console.log(`   + ${p}`));
  }

  if (updatedPlayers.length > 0) {
    console.log(`\n🔄 Updated players:`);
    updatedPlayers.forEach((p) => console.log(`   ~ ${p}`));
  }

  if (skippedPlayers.length > 0) {
    console.log(`\n⏭️  Already in database:`);
    skippedPlayers.forEach((p) => console.log(`   - ${p}`));
  }

  if (errorPlayers.length > 0) {
    console.log(`\n❌ Errors:`);
    errorPlayers.forEach((p) => console.log(`   ! ${p}`));
  }

  console.log(`\n═══════════════════════════════════════\n`);

  await mongoose.disconnect();
  console.log("Database connection closed.");
}

importPlayers().catch((err) => {
  console.error("Import failed:", err.message);
  process.exit(1);
});
