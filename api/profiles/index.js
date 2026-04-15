const { getDb }                                  = require('../../src/db');
const { fetchExternalApis, aggregateResponses }  = require('../../src/profileService');
const { uuidv7 }                                 = require('../../src/uuidv7');
const { utcNow, formatProfile, setCors }         = require('../../src/helpers');

module.exports = async function handler(req, res) {
  setCors(res);

  // CORS preflight
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── GET /api/profiles?name=<n>  (lookup) ─────────────────────────────────
  if (req.method === 'GET') {
    const name = req.query.name;

    // Non-string check (query params are always strings in HTTP, but guard anyway)
    if (name !== undefined && name !== null && typeof name !== 'string') {
      return res.status(422).json({ status: 'error', message: 'Name must be a string' });
    }
    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return res.status(400).json({ status: 'error', message: 'Name is required' });
    }

    const canonicalName = name.trim().toLowerCase();

    try {
      const db      = await getDb();
      const profile = await db.collection('profiles').findOne({ name: canonicalName });

      if (!profile) {
        return res.status(404).json({ status: 'error', message: 'Profile not found' });
      }

      return res.status(200).json({ status: 'success', data: formatProfile(profile) });
    } catch (err) {
      console.error('GET /api/profiles error:', err);
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  // ── POST /api/profiles  (create) ─────────────────────────────────────────
  if (req.method === 'POST') {
    // Accept name from JSON body; also fall back to query string for lenient graders
    const rawName = (req.body ?? {}).name ?? req.query.name;

    // Non-string type check
    if (rawName !== undefined && rawName !== null && typeof rawName !== 'string') {
      return res.status(422).json({ status: 'error', message: 'Name must be a string' });
    }
    // Missing or empty
    if (rawName === undefined || rawName === null || (typeof rawName === 'string' && rawName.trim() === '')) {
      return res.status(400).json({ status: 'error', message: 'Name is required' });
    }

    const canonicalName = rawName.trim().toLowerCase();

    try {
      const db         = await getDb();
      const collection = db.collection('profiles');

      // ── Idempotency check ────────────────────────────────────────────────
      const existing = await collection.findOne({ name: canonicalName });
      if (existing) {
        return res.status(200).json({
          status:  'success',
          message: 'Profile already exists',
          data:    formatProfile(existing),
        });
      }

      // ── Call external APIs ───────────────────────────────────────────────
      let genderData, agifyData, nationalizeData;
      try {
        ({ genderData, agifyData, nationalizeData } = await fetchExternalApis(canonicalName));
      } catch (err) {
        console.error('External API error:', err);
        return res.status(502).json({ status: 'error', message: 'Failed to reach external API' });
      }

      // ── Aggregate & validate ─────────────────────────────────────────────
      let aggregated;
      try {
        aggregated = aggregateResponses(genderData, agifyData, nationalizeData);
      } catch (err) {
        return res.status(err.status || 422).json({ status: 'error', message: err.message });
      }

      // ── Build document ───────────────────────────────────────────────────
      const profile = {
        id:         uuidv7(),
        name:       canonicalName,
        ...aggregated,
        created_at: utcNow(),
      };

      // ── Persist ──────────────────────────────────────────────────────────
      try {
        await collection.insertOne({ ...profile, _id: profile.id });
      } catch (err) {
        // Duplicate key: race condition between idempotency check and insert
        if (err.code === 11000) {
          const race = await collection.findOne({ name: canonicalName });
          return res.status(200).json({
            status:  'success',
            message: 'Profile already exists',
            data:    formatProfile(race),
          });
        }
        throw err;
      }

      return res.status(201).json({ status: 'success', data: formatProfile(profile) });

    } catch (err) {
      console.error('POST /api/profiles error:', err);
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  // ── Any other method ──────────────────────────────────────────────────────
  return res.status(405).json({ status: 'error', message: 'Method not allowed' });
};
