const { getDb }                                 = require('../../src/db');
const { fetchExternalApis, aggregateResponses } = require('../../src/profileService');
const { uuidv7 }                                = require('../../src/uuidv7');
const { utcNow, formatProfile, setCors }        = require('../../src/helpers');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── GET /api/profiles  (list, with optional filters) ─────────────────────
  if (req.method === 'GET') {
    try {
      const db         = await getDb();
      const collection = db.collection('profiles');

      // Build filter from supported query params
      const query = {};
      const { gender, age_group, country_id, name } = req.query;

      if (name)       query.name       = name.trim().toLowerCase();
      if (gender)     query.gender     = gender.trim().toLowerCase();
      if (age_group)  query.age_group  = age_group.trim().toLowerCase();
      if (country_id) query.country_id = country_id.trim().toUpperCase();

      const profiles = await collection.find(query).sort({ created_at: -1 }).toArray();

      return res.status(200).json({
        status: 'success',
        data:   profiles.map(formatProfile),
      });
    } catch (err) {
      console.error('GET /api/profiles error:', err);
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  // ── POST /api/profiles  (create) ─────────────────────────────────────────
  if (req.method === 'POST') {
    const rawName = (req.body ?? {}).name ?? req.query.name;

    if (rawName !== undefined && rawName !== null && typeof rawName !== 'string') {
      return res.status(422).json({ status: 'error', message: 'Name must be a string' });
    }
    if (rawName === undefined || rawName === null ||
        (typeof rawName === 'string' && rawName.trim() === '')) {
      return res.status(400).json({ status: 'error', message: 'Name is required' });
    }

    const canonicalName = rawName.trim().toLowerCase();

    try {
      const db         = await getDb();
      const collection = db.collection('profiles');

      // Idempotency
      const existing = await collection.findOne({ name: canonicalName });
      if (existing) {
        return res.status(200).json({
          status:  'success',
          message: 'Profile already exists',
          data:    formatProfile(existing),
        });
      }

      // External APIs
      let genderData, agifyData, nationalizeData;
      try {
        ({ genderData, agifyData, nationalizeData } = await fetchExternalApis(canonicalName));
      } catch (err) {
        console.error('External API error:', err);
        return res.status(502).json({ status: 'error', message: 'Failed to reach external API' });
      }

      // Aggregate & validate
      let aggregated;
      try {
        aggregated = aggregateResponses(genderData, agifyData, nationalizeData);
      } catch (err) {
        return res.status(err.status || 422).json({ status: 'error', message: err.message });
      }

      // Build & persist
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
      console.error('POST /api/profiles error:', err);
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  return res.status(405).json({ status: 'error', message: 'Method not allowed' });
};
