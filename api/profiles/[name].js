const { getDb }                  = require('../../src/db');
const { formatProfile, setCors } = require('../../src/helpers');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const { name } = req.query;

  try {
    const db      = await getDb();
    const profile = await db.collection('profiles').findOne({ name: name.toLowerCase() });

    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }

    return res.status(200).json({ status: 'success', data: formatProfile(profile) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};
