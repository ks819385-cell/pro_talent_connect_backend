/**
 * Scout Friendly Report™ — Scoring Calculator
 * Pro Talent Connect Plus (+)
 *
 * Official Grading & Evaluation Framework
 * Total Score: 100 Maximum | Grades: A–E
 *
 * Score Breakdown (max 100):
 *   Age Prospect         : 5
 *   Physical Profile     : 5
 *   Transfer Market      : 7.5
 *   Competition Level    : 50
 *   Championship Bonus   : uncapped
 *   State League         : 2
 *   Club Reputation      : 3  ← auto-detected from clubsPlayed names
 *   Speed (Sprint 30m)   : 2
 *   Mentality            : 2
 */

// ─── 4.1 Age – Future Prospect Weightage (max 5) ───
function calcAgeScore(age) {
  if (!age || isNaN(age) || age < 16) return 0;
  age = parseInt(age);
  if (age <= 17) return 5;
  if (age <= 19) return 4;
  if (age <= 21) return 2;
  if (age <= 23) return 1;
  return 0; // 24+
}

// ─── 4.2 Physical Profile (max 5) ───
function calcPhysicalScore(height, weight, position) {
  let score = 0;

  // BMI sub-score (max 3)
  if (height && weight && !isNaN(height) && !isNaN(weight)) {
    const heightM = parseFloat(height) / 100;
    const bmi = parseFloat(weight) / (heightM * heightM);
    if (bmi >= 18.5 && bmi <= 24.9) score += 3;       // Healthy
    else if ((bmi >= 17 && bmi < 18.5) || (bmi > 24.9 && bmi <= 27)) score += 2; // Near healthy
    else if (bmi > 0) score += 1;                       // Red zone
  }

  // Height sub-score (max 2) — position-adjusted
  if (height && !isNaN(height)) {
    const h = parseFloat(height);
    const pos = (position || "").toLowerCase();
    const isExempt = pos.includes("winger") || pos.includes("midfielder") || pos.includes("mid");
    if (h >= 180) score += 2;
    else if (h >= 170) score += 1;
    else score += isExempt ? 1 : 0;
  }

  return Math.min(score, 5);
}

// ─── 4.3 Transfer Market Presence (max 7.5) ───
function hasValidTransferMarketProfile(transferMarketLink) {
  if (!transferMarketLink || typeof transferMarketLink !== "string") return false;

  const link = transferMarketLink.trim();
  if (!link) return false;

  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();

    // Accept Transfermarkt country domains and profile paths like /.../profil/spieler/...
    return host.includes("transfermarkt.") && path.includes("/profil/");
  } catch {
    return false;
  }
}

function calcTransferMarketScore(transferMarketLink) {
  return hasValidTransferMarketProfile(transferMarketLink) ? 7.5 : 0;
}

// ─── 4.4 Competition Weightage (max 50) ───
const COMPETITION_POINTS = {
  "National Team": 25,
  "I-League Senior": 20,
  "I-League 2": 18.5,
  "I-League 3": 18,
  "State Franchise League": 18.5,
  "Santosh Trophy": 15,
  "National Youth Championships": 10,
  "Foreign Exposure": 7.5,
  "Elite Youth I-League": 5,
  RFDL: 5,
  "State League": 3,
  "State Youth League": 2,
  "District League": 1.5,
  Other: 0,
};

function calcCompetitionScore(competitions) {
  if (!competitions || !Array.isArray(competitions) || competitions.length === 0) return 0;
  let total = 0;
  try {
    for (const comp of competitions) {
      if (comp && comp.type && COMPETITION_POINTS[comp.type]) {
        total += COMPETITION_POINTS[comp.type];
      }
    }
  } catch (e) {
    console.error("Error calculating competition score:", e);
    return 0;
  }
  return Math.min(total, 50);
}

// ─── 4.5 Championship Bonus ───
function calcChampionshipBonus(competitions) {
  if (!competitions || !Array.isArray(competitions) || competitions.length === 0) return 0;
  let bonus = 0;
  try {
    for (const comp of competitions) {
      if (comp && comp.result) {
        if (comp.result === "Champion") bonus += 2;
        else if (comp.result === "Runner-up") bonus += 1;
        else if (comp.result === "Third") bonus += 0.5;
      }
    }
  } catch (e) {
    console.error("Error calculating championship bonus:", e);
  }
  return bonus;
}

// ─── 4.6 State League Recognition (max 2) ───
const STATE_LEAGUE_POINTS = {
  // Short names (original calculator names)
  "Calcutta Premier Division": 2,
  "Mizoram PL":                2,
  "BDFA Super Division":       2,
  "Goa Pro League":            2,
  "Kerala PL":                 1.5,
  "Shillong PL":               1.5,
  "Assam PL":                  1.5,
  INAL:                        1,
  "Delhi PL":                  0.5,
  "Mumbai Elite":              0.5,
  // Full names (as stored in the Leagues DB / dropdown)
  "Calcutta Football League":  2,
  "Mizoram Premier League":    2,
  "Goa Professional League":   2,
  "Kerala Premier League":     1.5,
  "Punjab State Super League": 1,
  "Bangalore Super Division":  1,
  "Manipur State League":      1,
  "Delhi Premier League":      0.5,
  "Mumbai Premier League":     0.5,
};

function calcStateLeagueBonus(stateLeague, currentLeague) {
  // Check stateLeague first, then fall back to currentLeague
  const candidates = [stateLeague, currentLeague].filter(
    (v) => v && typeof v === "string" && v.trim().length > 0
  );
  for (const league of candidates) {
    const normalized = league.trim().toLowerCase();
    for (const [key, pts] of Object.entries(STATE_LEAGUE_POINTS)) {
      if (key.toLowerCase() === normalized) return pts;
    }
  }
  return 0;
}

// ─── 4.7 Club Reputation — Auto-detected from clubsPlayed (max 12) ───
// Tier 1: ISL clubs (top flight)
const TIER1_CLUBS = [
  "bengaluru fc", "mumbai city fc", "mumbai city",
  "atk mohun bagan", "mohun bagan super giant", "mohun bagan",
  "kerala blasters fc", "kerala blasters", "kbfc",
  "hyderabad fc", "hfc",
  "odisha fc", "ofc",
  "fc goa", "goa fc",
  "jamshedpur fc", "jfc",
  "northeast united fc", "northeast united", "northeastunited", "neufc",
  "chennaiyin fc", "cfc",
  "east bengal fc", "east bengal",
  "punjab fc",
  "mumbai fc",
  "minerva punjab fc", "minerva punjab",
];

// Tier 2: I-League clubs
const TIER2_CLUBS = [
  "mohammedan sc", "mohammedan sporting",
  "gokulam kerala fc", "gokulam kerala",
  "sreenidi deccan fc", "sreenidi deccan",
  "roundglass punjab fc", "roundglass punjab",
  "sudeva delhi fc", "sudeva delhi", "sudeva",
  "trau fc", "trau",
  "churchill brothers sc", "churchill brothers",
  "aizawl fc", "aizawl",
  "rajasthan united fc", "rajasthan united",
  "real kashmir fc", "real kashmir",
  "neroca fc", "neroca",
  "shillong lajong fc", "shillong lajong",
  "chennai city fc",
  "bhawanipore fc",
  "salgaocar fc", "salgaocar",
  "dempo sc", "dempo",
  "sporting club de goa",
  "fc bengaluru united",
  "delhi fc", "delhi dynamos",
  "waterford fc",
];

// Tier 3: I-League 2 / state-level clubs
const TIER3_CLUBS = [
  "delhi united fc", "delhi united",
  "kenkre fc", "kenkre",
  "fc bengaluru",
  "ozone fc",
  "decan clue",
  "garhwal fc",
  "young mizo",
  "rntc",
];

const CLUB_TIER_SCORES = { 1: 3, 2: 2, 3: 1 };

/**
 * Determines the best club tier from the clubsPlayed array by matching
 * club names against known Indian football club lists.
 * Falls back to manually set clubTier field if no matches found.
 */
function detectClubTier(clubsPlayed, manualClubTier) {
  let bestTier = null;

  if (Array.isArray(clubsPlayed) && clubsPlayed.length > 0) {
    for (const entry of clubsPlayed) {
      if (!entry || !entry.clubName) continue;
      const name = entry.clubName.toLowerCase().trim();

      if (TIER1_CLUBS.some((c) => name.includes(c) || c.includes(name))) {
        bestTier = 1;
        break; // Can't go higher
      } else if (TIER2_CLUBS.some((c) => name.includes(c) || c.includes(name))) {
        if (bestTier === null || bestTier > 2) bestTier = 2;
      } else if (TIER3_CLUBS.some((c) => name.includes(c) || c.includes(name))) {
        if (bestTier === null || bestTier > 3) bestTier = 3;
      }
    }
  }

  // If no auto match, fall back to manually set field
  if (bestTier === null && manualClubTier) {
    if (manualClubTier === "Tier 1") bestTier = 1;
    else if (manualClubTier === "Tier 2") bestTier = 2;
    else if (manualClubTier === "Tier 3") bestTier = 3;
  }

  return bestTier;
}

function calcClubReputationBonus(clubsPlayed, manualClubTier) {
  const tier = detectClubTier(clubsPlayed, manualClubTier);
  return tier ? CLUB_TIER_SCORES[tier] : 0;
}

// ─── 4.8 Speed Metrics / Sprint 30m (max 2) ───
function calcSpeedScore(sprint30m) {
  if (!sprint30m || isNaN(sprint30m)) return 0;
  const t = parseFloat(sprint30m);
  if (t < 4.1) return 2;  // Elite
  if (t <= 4.4) return 1; // Above average
  return 0;               // Below benchmark
}

// ─── 4.9 Mentality Assessment (max 2) ───
function calcMentalityScore(mentalityScore) {
  if (!mentalityScore || isNaN(mentalityScore)) return 0;
  const s = parseInt(mentalityScore);
  if (s === 2) return 2; // Strong mentality
  if (s === 1) return 1; // Good mentality
  return 0;
}

// ─── Grade from total score ───
function getGrade(total) {
  if (total >= 80) return "A"; // Elite
  if (total >= 70) return "B"; // Professional
  if (total >= 50) return "C"; // Semi-Professional
  if (total >= 35) return "D"; // Amateur
  return "E";                  // Semi-Amateur
}

// ─── Master calculator ───
function calculateScoutReport(player) {
  try {
    if (!player || typeof player !== "object") {
      console.error("Invalid player object for scout report calculation");
      return {
        ageScore: 0, physicalScore: 0, transferMarketScore: 0,
        competitionScore: 0, championshipBonus: 0, stateLeagueBonus: 0,
        clubReputationBonus: 0, speedScore: 0, mentalityAssessment: 0,
        totalScore: 0, grade: "",
      };
    }

    const ageScore            = calcAgeScore(player.age);
    const physicalScore       = calcPhysicalScore(player.height, player.weight, player.playingPosition);
    const transferMarketScore = calcTransferMarketScore(player.transferMarketLink);
    const competitionScore    = calcCompetitionScore(player.competitions);
    const championshipBonus   = calcChampionshipBonus(player.competitions);
    const stateLeagueBonus    = calcStateLeagueBonus(player.stateLeague, player.currentLeague);
    const clubReputationBonus = calcClubReputationBonus(player.clubsPlayed, player.clubTier);
    const speedScore          = calcSpeedScore(player.sprint30m);
    const mentalityAssessment = calcMentalityScore(player.mentalityScore);

    let rawTotal =
      (ageScore || 0) +
      (physicalScore || 0) +
      (transferMarketScore || 0) +
      (competitionScore || 0) +
      (championshipBonus || 0) +
      (stateLeagueBonus || 0) +
      (clubReputationBonus || 0) +
      (speedScore || 0) +
      (mentalityAssessment || 0);

    if (isNaN(rawTotal)) rawTotal = 0;

    const totalScore = Math.min(Math.max(Math.round(rawTotal * 10) / 10, 0), 100);

    let grade;
    if (totalScore === 0)    grade = "N/A";
    else if (totalScore < 5) grade = "INCOMPLETE";
    else                     grade = getGrade(totalScore);

    return {
      ageScore, physicalScore, transferMarketScore,
      competitionScore, championshipBonus, stateLeagueBonus,
      clubReputationBonus, speedScore, mentalityAssessment,
      totalScore, grade,
    };
  } catch (err) {
    console.error("Error calculating scout report:", err);
    return {
      ageScore: 0, physicalScore: 0, transferMarketScore: 0,
      competitionScore: 0, championshipBonus: 0, stateLeagueBonus: 0,
      clubReputationBonus: 0, speedScore: 0, mentalityAssessment: 0,
      totalScore: 0, grade: "N/A",
    };
  }
}

module.exports = {
  calculateScoutReport,
  getGrade,
  detectClubTier,
};
