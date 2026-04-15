const { MongoClient } = require('mongodb');

let client = null;
let db     = null;

async function getDb() {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS:         5000,
  });

  await client.connect();
  db = client.db(process.env.MONGODB_DB || 'profileapi');

  // Unique index enforces idempotency at the database level
  await db.collection('profiles').createIndex({ name: 1 }, { unique: true });

  return db;
}

module.exports = { getDb };
