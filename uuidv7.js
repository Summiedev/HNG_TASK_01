const { randomBytes } = require('crypto');

/**
 * Generate UUID v7 (time-ordered)
 * Format: unix_ts_ms (48 bits) | ver (4 bits) | rand_a (12 bits) | var (2 bits) | rand_b (62 bits)
 */
function uuidv7() {
  const now = Date.now();

  // 48-bit timestamp in ms
  const tsBuf = Buffer.allocUnsafe(8);
  tsBuf.writeBigUInt64BE(BigInt(now));
  const tsHigh = tsBuf.readUInt32BE(2); // top 32 bits of 48-bit ts
  const tsLow = tsBuf.readUInt16BE(6);  // bottom 16 bits of 48-bit ts

  const rand = randomBytes(10);

  // version 7
  const ver = 0x7000;
  const randA = ((rand[0] & 0x0f) << 8) | rand[1]; // 12 bits

  // variant 0b10xxxxxx
  rand[2] = (rand[2] & 0x3f) | 0x80;

  const hex = [
    tsHigh.toString(16).padStart(8, '0'),
    tsLow.toString(16).padStart(4, '0'),
    (ver | randA).toString(16).padStart(4, '0'),
    rand.slice(2, 4).toString('hex'),
    rand.slice(4, 10).toString('hex'),
  ].join('-');

  return hex;
}

module.exports = { uuidv7 };
