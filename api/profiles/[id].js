const { getDb }                  = require('../../src/db');
const { formatProfile, setCors } = require('../../src/helpers');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // The dynamic segment is the filename key: [id] → req.query.id
  const segment = req.query.id;

  if (!segment || typeof segment !== 'string' || segment.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'ID is required' });
  }

  const value = segment.trim();

  // ── GET /api/profiles/:id ─────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const db         = await getDb();
      const collection = db.collection('profiles');

      // Try by UUID id first, then fall back to name lookup
      const profile = await collection.findOne({ id: value })
                   ?? await collection.findOne({ name: value.toLowerCase() });

      if (!profile) {
        return res.status(404).json({ status: 'error', message: 'Profile not found' });
      }

      return res.status(200).json({ status: 'success', data: formatProfile(profile) });
    } catch (err) {
      console.error('GET /api/profiles/:id error:', err);
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  // ── DELETE /api/profiles/:id ──────────────────────────────────────────────
  if (req.method === 'DELETE') {
    try {
      const db     = await getDb();
      const result = await db.collection('profiles').deleteOne({ id: value });

      if (result.deletedCount === 0) {
        return res.status(404).json({ status: 'error', message: 'Profile not found' });
      }

      return res.status(204).end();
    } catch (err) {
      console.error('DELETE /api/profiles/:id error:', err);
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  return res.status(405).json({ status: 'error', message: 'Method not allowed' });
};
