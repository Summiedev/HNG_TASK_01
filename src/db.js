const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/profiles.db');

let db = null;

async function initDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      id                  TEXT PRIMARY KEY,
      name                TEXT UNIQUE NOT NULL,
      gender              TEXT,
      gender_probability  REAL,
      sample_size         INTEGER,
      age                 INTEGER,
      age_group           TEXT,
      country_id          TEXT,
      country_probability REAL,
      created_at          TEXT NOT NULL
    )
  `);

  persist();
  return db;
}

function persist() {
  if (!db) return;
  const data = db.export();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function requireDb() {
  if (!db) throw new Error('Database not initialised — call initDb() first');
  return db;
}

function insertProfile(profile) {
  const d = requireDb();
  d.run(
    `INSERT INTO profiles
       (id, name, gender, gender_probability, sample_size,
        age, age_group, country_id, country_probability, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profile.id, profile.name, profile.gender, profile.gender_probability,
      profile.sample_size, profile.age, profile.age_group,
      profile.country_id, profile.country_probability, profile.created_at,
    ]
  );
  persist();
}

function findProfileByName(name) {
  const d = requireDb();
  const stmt = d.prepare('SELECT * FROM profiles WHERE name = ?');
  stmt.bind([name]);
  const found = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return found;
}

module.exports = { initDb, insertProfile, findProfileByName };
