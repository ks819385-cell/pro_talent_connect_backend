/**
 * Migration Script: Move ALL data from 'test' database to 'protalent' database
 * Run: node migrate-data.js
 */

const { MongoClient } = require("mongodb");

const ATLAS_BASE = "mongodb+srv://LasyWork:dlJZLoSXtG08hP8G@protalent.e70myun.mongodb.net";

const SOURCE_URI = `${ATLAS_BASE}/test?appName=Protalent`;
const TARGET_URI = `${ATLAS_BASE}/protalent?appName=Protalent`;

async function migrate() {
  let sourceClient, targetClient;

  try {
    console.log("Connecting to source (test) database...");
    sourceClient = new MongoClient(SOURCE_URI);
    await sourceClient.connect();
    const sourceDb = sourceClient.db("test");

    console.log("Connecting to target (protalent) database...");
    targetClient = new MongoClient(TARGET_URI);
    await targetClient.connect();
    const targetDb = targetClient.db("protalent");

    // Get all collections from test database
    const collections = await sourceDb.listCollections().toArray();
    console.log(`\nFound ${collections.length} collections in 'test' database:`);
    collections.forEach((c) => console.log(`  - ${c.name}`));

    if (collections.length === 0) {
      console.log("\nNo collections found in 'test' database. Nothing to migrate.");
      return;
    }

    for (const collInfo of collections) {
      const collName = collInfo.name;
      console.log(`\n--- Migrating collection: ${collName} ---`);

      const sourceColl = sourceDb.collection(collName);
      const targetColl = targetDb.collection(collName);

      const docs = await sourceColl.find({}).toArray();
      console.log(`  Found ${docs.length} documents in source`);

      if (docs.length === 0) {
        console.log(`  Skipping (empty collection)`);
        continue;
      }

      // Check existing count in target
      const existingCount = await targetColl.countDocuments();
      console.log(`  Existing documents in target: ${existingCount}`);

      // Use insertMany with ordered:false to skip duplicates
      try {
        const result = await targetColl.insertMany(docs, { ordered: false });
        console.log(`  ✅ Inserted ${result.insertedCount} documents into 'protalent.${collName}'`);
      } catch (err) {
        if (err.code === 11000) {
          // Duplicate key errors - some docs already exist
          const inserted = err.result?.insertedCount || err.insertedCount || 0;
          console.log(`  ⚠️  Inserted ${inserted} new documents (${docs.length - inserted} duplicates skipped)`);
        } else {
          console.error(`  ❌ Error migrating ${collName}:`, err.message);
        }
      }
    }

    console.log("\n========================================");
    console.log("✅ Migration complete!");
    console.log("========================================");

    // Verify target
    const targetCollections = await targetDb.listCollections().toArray();
    console.log(`\nCollections now in 'protalent' database:`);
    for (const c of targetCollections) {
      const count = await targetDb.collection(c.name).countDocuments();
      console.log(`  - ${c.name}: ${count} documents`);
    }

  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  } finally {
    if (sourceClient) await sourceClient.close();
    if (targetClient) await targetClient.close();
    console.log("\nDatabase connections closed.");
  }
}

migrate();
