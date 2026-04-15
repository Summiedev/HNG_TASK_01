const express = require('express');
const { insertProfile, findProfileByName } = require('./db');
const { fetchExternalApis, aggregateResponses } = require('./profileService');
const { uuidv7 } = require('./uuidv7');

const app = express();
app.use(express.json());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── POST /api/profiles ────────────────────────────────────────────────────────
app.post('/api/profiles', async (req, res) => {
  const { name } = req.body ?? {};

  // 1. Non-string check first (422)
  if (name !== undefined && name !== null && typeof name !== 'string') {
    return res.status(422).json({ status: 'error', message: 'Name must be a string' });
  }

  // 2. Missing / empty (400)
  if (name === undefined || name === null || (typeof name === 'string' && name.trim() === '')) {
    return res.status(400).json({ status: 'error', message: 'Name is required' });
  }

  const canonicalName = name.trim().toLowerCase();

  try {
    // Idempotency
    const existing = findProfileByName(canonicalName);
    if (existing) {
      return res.status(200).json({
        status: 'success',
        message: 'Profile already exists',
        data: formatProfile(existing),
      });
    }

    // Call all three external APIs in parallel
    let genderData, agifyData, nationalizeData;
    try {
      ({ genderData, agifyData, nationalizeData } = await fetchExternalApis(canonicalName));
    } catch (apiErr) {
      const code = apiErr.status || 502;
      return res.status(code).json({ status: 'error', message: apiErr.message || 'External API unavailable' });
    }

    // Aggregate + classify
    let aggregated;
    try {
      aggregated = aggregateResponses(genderData, agifyData, nationalizeData);
    } catch (aggErr) {
      const code = aggErr.status || 422;
      return res.status(code).json({ status: 'error', message: aggErr.message });
    }

    const profile = {
      id: uuidv7(),
      name: canonicalName,
      ...aggregated,
      created_at: utcNow(),
    };

    insertProfile(profile);

    return res.status(201).json({ status: 'success', data: formatProfile(profile) });

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── GET /api/profiles/:name ───────────────────────────────────────────────────
app.get('/api/profiles/:name', (req, res) => {
  const profile = findProfileByName(req.params.name.toLowerCase());
  if (!profile) {
    return res.status(404).json({ status: 'error', message: 'Profile not found' });
  }
  return res.json({ status: 'success', data: formatProfile(profile) });
});

// ── GET /health ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: utcNow() });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function utcNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function coerceNum(v, fn) {
  return typeof v === 'number' ? v : fn(v);
}

function formatProfile(p) {
  return {
    id: p.id,
    name: p.name,
    gender: p.gender,
    gender_probability: coerceNum(p.gender_probability, parseFloat),
    sample_size: coerceNum(p.sample_size, n => parseInt(n, 10)),
    age: coerceNum(p.age, n => parseInt(n, 10)),
    age_group: p.age_group,
    country_id: p.country_id,
    country_probability: coerceNum(p.country_probability, parseFloat),
    created_at: p.created_at,
  };
}

module.exports = app;
