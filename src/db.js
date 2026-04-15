const { MongoClient } = require('mongodb');

// Reuse connection across warm serverless invocations
let client = null;
let db = null;

async function getDb() {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });

  await client.connect();
  db = client.db(process.env.MONGODB_DB || 'profileapi');

  // Ensure unique index on name for idempotency at DB level
  await db.collection('profiles').createIndex({ name: 1 }, { unique: true });

  return db;
}

module.exports = { getDb };
