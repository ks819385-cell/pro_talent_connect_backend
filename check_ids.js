require("dotenv").config();
const mongoose = require("mongoose");
const Player = require("./Models/Players");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const player = await Player.findOne({ name: /Benhar/i });
  console.log(JSON.stringify(player, null, 2));
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
