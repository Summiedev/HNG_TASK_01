const { setCors } = require('../src/helpers');

module.exports = function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
};
