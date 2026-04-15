const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON from ' + url)); }
      });
    }).on('error', reject);
  });
}

async function fetchExternalApis(name) {
  const encoded = encodeURIComponent(name);
  const [genderData, agifyData, nationalizeData] = await Promise.all([
    httpsGet(`https://api.genderize.io/?name=${encoded}`),
    httpsGet(`https://api.agify.io/?name=${encoded}`),
    httpsGet(`https://api.nationalize.io/?name=${encoded}`),
  ]);
  return { genderData, agifyData, nationalizeData };
}

function classifyAge(age) {
  if (age <= 12)  return 'child';
  if (age <= 19)  return 'teenager';
  if (age <= 59)  return 'adult';
  return 'senior';
}

/**
 * is_confident = true when all three external APIs returned high-confidence
 * data for this name:
 *   - genderize: probability >= 0.80 AND count >= 100
 *   - agify:     count >= 100
 *   - nationalize: top country probability >= 0.10
 *
 * For names where any API returns null/empty or low-confidence values
 * (e.g. nonsense strings) is_confident is false.
 */
function computeConfidence(genderData, agifyData, nationalizeData) {
  const genderOk    = (genderData.probability ?? 0) >= 0.80
                   && (genderData.count       ?? 0) >= 100;
  const agifyOk     = (agifyData.count        ?? 0) >= 100;
  const topProb     = nationalizeData.country?.[0]?.probability ?? 0;
  const nationalOk  = topProb >= 0.10;
  return genderOk && agifyOk && nationalOk;
}

function aggregateResponses(genderData, agifyData, nationalizeData) {
  // Genderize validation
  if (!genderData.gender) {
    throw { status: 422, message: 'Genderize returned no gender data for this name' };
  }
  if (!genderData.count || genderData.count === 0) {
    throw { status: 422, message: 'Genderize returned zero sample count for this name' };
  }

  // Agify validation
  if (agifyData.age === null || agifyData.age === undefined) {
    throw { status: 422, message: 'Agify returned no age data for this name' };
  }

  // Nationalize validation
  if (!nationalizeData.country || nationalizeData.country.length === 0) {
    throw { status: 422, message: 'Nationalize returned no country data for this name' };
  }

  const topCountry = nationalizeData.country.reduce((best, c) =>
    c.probability > best.probability ? c : best
  );

  const is_confident = computeConfidence(genderData, agifyData, nationalizeData);

  return {
    gender:              genderData.gender,
    gender_probability:  genderData.probability,
    sample_size:         genderData.count,
    age:                 agifyData.age,
    age_group:           classifyAge(agifyData.age),
    country_id:          topCountry.country_id,
    country_probability: topCountry.probability,
    is_confident,
  };
}

module.exports = { fetchExternalApis, aggregateResponses };
