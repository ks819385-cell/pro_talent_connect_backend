require("dotenv").config();
const mongoose = require("mongoose");
const Blog = require("./Models/Blog");
const Admin = require("./Models/Admin");

const CATEGORIES = ["Transfers", "Achievements", "Announcements", "News", "General"];

const IMAGE_POOL = [
  "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1486286701208-1d58e9338013?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1471295253337-3ceaaedca402?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1562077772-3bd90403f7f0?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1600&q=80",
];

const INDIA_TEAMS = ["India Senior Men", "India Senior Women", "India U23", "India U19", "India U17", "India U16"];
const OPPONENTS = ["Qatar", "Uzbekistan", "Iraq", "Thailand", "Vietnam", "Jordan", "Kyrgyz Republic", "Maldives", "Nepal", "Bahrain"];
const TOURNAMENTS = ["FIFA World Cup", "AFC Asian Cup", "SAFF Championship", "AFC U23 Asian Cup", "AFC U17 Asian Cup", "Durand Cup", "Intercontinental Cup"];
const CITIES = ["Kolkata", "Goa", "Bhubaneswar", "Imphal", "Kochi", "Mumbai", "Bengaluru", "Chennai", "Pune", "Guwahati"];
const TALENT_POSITIONS = ["forward", "creative midfielder", "holding midfielder", "left-back", "centre-back", "goalkeeper", "right winger"];
const CONTROVERSY_TOPICS = [
  "age-verification loopholes",
  "travel and recovery scheduling",
  "uneven refereeing standards",
  "late salary processing in lower divisions",
  "academy release clauses",
  "fixture congestion",
  "training load monitoring gaps",
];

function pick(arr, idx) {
  return arr[idx % arr.length];
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function estimateReadTime(content) {
  const words = content.split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.ceil(words / 220));
}

function worldCupBlog(idx) {
  const city = pick(CITIES, idx);
  const cup = pick(["FIFA World Cup 2026", "FIFA World Cup 2030"], idx);
  const title = `${cup}: What India Must Build Before the Next Qualification Cycle`;
  const excerpt = `A grounded look at preparation priorities from ${city}, including tactical identity, transition speed, and squad depth for the World Cup qualification path.`;
  const content = [
    `World Cup conversations in India usually swing between excitement and frustration. The reality is simpler: qualification is a long-cycle project that rewards process over noise. From analysis sessions in ${city}, three priorities are becoming clear.`,
    "",
    "### 1) Tactical Identity Before Individual Hype",
    "India needs a repeatable game model that survives venue changes and opponent quality. The best benchmark is not one-off upsets, but performance consistency across six to eight matches.",
    "",
    "### 2) Transition Speed and Midfield Balance",
    "The next step is improving the first eight seconds after regains and losses. That is where qualification campaigns are won, especially against compact opponents.",
    "",
    "### 3) Squad Depth, Not Just Starting XI",
    "Qualification windows demand rotation. If India can trust 18 to 20 players with clear roles, tactical continuity improves and late-game control becomes realistic.",
    "",
    "The World Cup path is not fantasy. It is hard, measurable, and absolutely possible with long-term planning and clear accountability.",
  ].join("\n");

  return {
    title,
    excerpt,
    content,
    category: "News",
    tags: ["world cup", "india football", "qualification", "national team"],
  };
}

function indiaMatchBlog(idx) {
  const team = pick(INDIA_TEAMS, idx);
  const opponent = pick(OPPONENTS, idx + 2);
  const city = pick(CITIES, idx + 1);
  const isUpcoming = idx % 2 === 0;
  const title = isUpcoming
    ? `${team} vs ${opponent}: Match Preview, Likely Shape, and Key Battles`
    : `${team} vs ${opponent}: Tactical Review, Turning Points, and Ratings`;

  const excerpt = isUpcoming
    ? `Upcoming match analysis from ${city}, including expected game-plan, set-piece ideas, and player matchups to watch.`
    : `Post-match breakdown from ${city} with tactical shifts, momentum moments, and practical takeaways for the next fixture.`;

  const content = isUpcoming
    ? [
        `${team} meets ${opponent} this week with a clear objective: control midfield transitions and protect wide channels. The staff expects a high-tempo start, especially in the opening 20 minutes.`,
        "",
        "### What to Watch",
        "- First-line pressing triggers in central zones.",
        "- Compact back-four distances during second-ball phases.",
        "- Delivery quality from dead-ball situations.",
        "",
        "### Predicted Game Script",
        "If India sustains passing speed through the half-spaces, chance quality should improve. The key is patience after turnovers and discipline in rest defence.",
      ].join("\n")
    : [
        `${team} against ${opponent} produced a game of two halves. India started with control but had to adapt after midfield pressure increased.`,
        "",
        "### Tactical Turning Points",
        "- Shape adjustment in the second phase to improve progression.",
        "- Better vertical support after substitutions.",
        "- Cleaner box occupation in final-third entries.",
        "",
        "### Next-Match Priorities",
        "The biggest improvement area is transition protection after wide attacks. Solve that, and the team gains both defensive stability and confidence in possession.",
      ].join("\n");

  return {
    title,
    excerpt,
    content,
    category: "News",
    tags: ["india match", "match analysis", team.toLowerCase(), opponent.toLowerCase()],
  };
}

function scoutingReportBlog(idx) {
  const city = pick(CITIES, idx + 3);
  const position = pick(TALENT_POSITIONS, idx);
  const title = `India Scouting Report: Three ${position}s Who Changed Selection Conversations`;
  const excerpt = `Scout desk notes from ${city} covering profile fit, role clarity, and development markers for national and club pathways.`;
  const content = [
    `Our India scouting review from ${city} focused on role suitability over highlight moments. This cycle, ${position}s stood out for decision quality and repeatable actions under pressure.`,
    "",
    "### Core Evaluation Markers",
    "- Execution speed in constrained spaces",
    "- Off-ball timing and positional discipline",
    "- Body orientation before receiving under pressure",
    "",
    "### Recruitment Insight",
    "The best profiles were not always the most physical. The difference came from game understanding and fast corrections between phases.",
    "",
    "### Development Recommendation",
    "Scouts and coaches should align language when writing reports. Shared terminology across clubs and state teams helps players transition faster into higher environments.",
  ].join("\n");

  return {
    title,
    excerpt,
    content,
    category: "General",
    tags: ["scouting report", "india scouting", "talent identification", position],
  };
}

function upcomingTournamentBlog(idx) {
  const tournament = pick(TOURNAMENTS, idx + 1);
  const city = pick(CITIES, idx + 4);
  const title = `Upcoming Tournaments Watchlist: What to Track Before ${tournament}`;
  const excerpt = `Tournament prep insights from ${city}, including workload management, squad flexibility, and tactical patterns likely to matter.`;
  const content = [
    `As teams prepare for ${tournament}, coaching staffs are balancing performance and freshness. From planning meetings in ${city}, the common question is simple: what metrics matter most before kickoff?`,
    "",
    "### Priority Checklist",
    "- Match fitness without overloading key players",
    "- Role clarity for second-unit players",
    "- Set-piece routines under fatigue",
    "",
    "### Why It Matters",
    "Tournament football rewards adaptability. Teams that prepare multiple game-states usually outperform teams built around one fixed script.",
    "",
    "### Practical Forecast",
    "Expect cautious opening rounds and more aggressive adjustments from matchday two onward as staff confidence in rotation improves.",
  ].join("\n");

  return {
    title,
    excerpt,
    content,
    category: "Announcements",
    tags: ["upcoming tournaments", tournament.toLowerCase(), "preview", "india football"],
  };
}

function youngTalentBlog(idx) {
  const city = pick(CITIES, idx + 5);
  const position = pick(TALENT_POSITIONS, idx + 2);
  const title = `Young Talents in India: Why This ${position} Generation Looks Different`;
  const excerpt = `A human-centered report from ${city} on young Indian players, including mindset, game intelligence, and pathway readiness.`;
  const content = [
    `In ${city}, youth coaches keep repeating one observation: this generation of Indian players asks better questions. For ${position}s in particular, tactical curiosity is turning into consistent match behavior.`,
    "",
    "### What Makes Them Stand Out",
    "- Better scanning habits before receiving",
    "- Quicker emotional reset after mistakes",
    "- More mature communication inside units",
    "",
    "### Pathway Reality",
    "Potential still needs structure. The players progressing fastest are the ones with stable match minutes, video feedback, and clear weekly objectives.",
    "",
    "### Human Side",
    "Families, local coaches, and school schedules still shape outcomes. The right support around the player is often as important as technical quality.",
  ].join("\n");

  return {
    title,
    excerpt,
    content,
    category: "Achievements",
    tags: ["young talents", "india youth", "player development", position],
  };
}

function controversyBlog(idx) {
  const topic = pick(CONTROVERSY_TOPICS, idx);
  const city = pick(CITIES, idx + 6);
  const title = `Controversial Findings in Indian Football: A Closer Look at ${topic}`;
  const excerpt = `An evidence-led analysis from ${city} that separates noise from facts and outlines practical reforms.`;
  const content = [
    `Not every controversy is useful, but some reveal structural issues. In recent discussions from ${city}, ${topic} has repeatedly surfaced among coaches, players, and administrators.`,
    "",
    "### What We Verified",
    "- The issue appears across multiple competition levels.",
    "- Consequences are felt most by developing players.",
    "- Existing protocols are uneven in enforcement.",
    "",
    "### What Should Change",
    "A better response starts with transparent reporting, consistent timelines, and independent review checkpoints. Reform is possible when everyone agrees on measurable standards.",
    "",
    "### Final Note",
    "Debate should improve football systems, not just feed headlines. The focus must remain on fairness, player welfare, and long-term credibility.",
  ].join("\n");

  return {
    title,
    excerpt,
    content,
    category: "News",
    tags: ["controversy", "indian football", "investigation", topic],
  };
}

const TOPIC_BUILDERS = [
  worldCupBlog,
  indiaMatchBlog,
  scoutingReportBlog,
  upcomingTournamentBlog,
  youngTalentBlog,
  controversyBlog,
];

async function uniqueSlug(baseSlug, usedSlugs) {
  let slug = baseSlug;
  let suffix = 2;
  while (usedSlugs.has(slug) || (await Blog.exists({ slug }))) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  usedSlugs.add(slug);
  return slug;
}

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set in .env");
  }

  const requested = Number(process.argv[2]);
  const count = Number.isFinite(requested) ? Math.max(40, Math.min(80, requested)) : 60;

  await mongoose.connect(process.env.MONGO_URI);

  const author = await Admin.findOne({ isDeleted: { $ne: true } }).select("_id name email");
  if (!author) {
    throw new Error("No admin user found. Create at least one admin before seeding blogs.");
  }

  const usedSlugs = new Set();
  const now = Date.now();
  const docs = [];

  for (let i = 0; i < count; i += 1) {
    const build = pick(TOPIC_BUILDERS, i);
    const topicBlog = build(i);
    const slug = await uniqueSlug(slugify(topicBlog.title), usedSlugs);
    const image = pick(IMAGE_POOL, i);

    docs.push({
      title: topicBlog.title,
      slug,
      content: topicBlog.content,
      excerpt: topicBlog.excerpt,
      author: author.name || "Pro Talent Connect Editorial",
      author_id: author._id,
      category: CATEGORIES.includes(topicBlog.category) ? topicBlog.category : "General",
      image,
      cover_image: image,
      readTime: estimateReadTime(topicBlog.content),
      tags: [...topicBlog.tags, "seeded", "football"],
      status: "PUBLISHED",
      published_at: new Date(now - i * 18 * 60 * 60 * 1000),
      isDeleted: false,
    });
  }

  const result = await Blog.insertMany(docs, { ordered: false });
  console.log(`Seed complete. Added ${result.length} topic-focused blogs.`);
  console.log(`Author used: ${author.name || author.email}`);
  console.log(`Count requested: ${count}`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Blog seed failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
