const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

jest.setTimeout(180000);

// Set env variables for testing
process.env.JWT_SECRET = "testsecret";
process.env.NODE_ENV = "test";
process.env.MONGOMS_MD5_CHECK = "0";

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});
