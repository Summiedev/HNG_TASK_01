const { getDb }                          = require('../../src/db');
const { fetchExternalApis, aggregateResponses } = require('../../src/profileService');
const { uuidv7 }                         = require('../../src/uuidv7');
const { utcNow, formatProfile, setCors } = require('../../src/helpers');

module.exports = async function handler(req, res) {
  setCors(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── GET /api/profiles?name=<n> ─────────────────────────────────────────
  if (req.method === 'GET') {
    const { name } = req.query;

    if (name !== undefined && name !== null && typeof name !== 'string') {
      return res.status(422).json({ status: 'error', message: 'Name must be a string' });
    }
    if (name === undefined || name === null || (typeof name === 'string' && name.trim() === '')) {
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
      console.error('Unhandled error:', err);
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  // ── POST /api/profiles ────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { name } = req.body ?? {};

    if (name !== undefined && name !== null && typeof name !== 'string') {
      return res.status(422).json({ status: 'error', message: 'Name must be a string' });
    }
    if (name === undefined || name === null || (typeof name === 'string' && name.trim() === '')) {
      return res.status(400).json({ status: 'error', message: 'Name is required' });
    }

    const canonicalName = name.trim().toLowerCase();

    try {
      const db         = await getDb();
      const collection = db.collection('profiles');

      const existing = await collection.findOne({ name: canonicalName });
      if (existing) {
        return res.status(200).json({
          status:  'success',
          message: 'Profile already exists',
          data:    formatProfile(existing),
        });
      }

      let genderData, agifyData, nationalizeData;
      try {
        ({ genderData, agifyData, nationalizeData } = await fetchExternalApis(canonicalName));
      } catch (err) {
        return res.status(502).json({ status: 'error', message: 'Failed to reach external API' });
      }

      let aggregated;
      try {
        aggregated = aggregateResponses(genderData, agifyData, nationalizeData);
      } catch (err) {
        return res.status(err.status || 422).json({ status: 'error', message: err.message });
      }

      const profile = {
        id:         uuidv7(),
        name:       canonicalName,
        ...aggregated,
        created_at: utcNow(),
      };

      try {
        await collection.insertOne({ ...profile, _id: profile.id });
      } catch (err) {
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
      console.error('Unhandled error:', err);
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  return res.status(405).json({ status: 'error', message: 'Method not allowed' });
};
