const { getDb }                  = require('../../src/db');
const { formatProfile, setCors } = require('../../src/helpers');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const rawName = req.query.name;
  if (!rawName || typeof rawName !== 'string' || rawName.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'Name is required' });
  }

  const canonicalName = rawName.trim().toLowerCase();

  try {
    const db      = await getDb();
    const profile = await db.collection('profiles').findOne({ name: canonicalName });

    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }

    return res.status(200).json({ status: 'success', data: formatProfile(profile) });
  } catch (err) {
    console.error('GET /api/profiles/:name error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};
