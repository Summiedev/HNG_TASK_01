function utcNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function formatProfile(p) {
  return {
    id:                  p.id,
    name:                p.name,
    gender:              p.gender,
    gender_probability:  p.gender_probability,
    sample_size:         p.sample_size,
    age:                 p.age,
    age_group:           p.age_group,
    country_id:          p.country_id,
    country_probability: p.country_probability,
    created_at:          p.created_at,
  };
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = { utcNow, formatProfile, setCors };
