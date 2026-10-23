const crypto = require('crypto');

// Format tersimpan: scrypt$N$r$p$saltHex$hashHex
const PREFIX = 'scrypt$';
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function isHashed(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(plain), salt, KEYLEN, { N, r: R, p: P });
  return `${PREFIX}${N}$${R}$${P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Mendukung hash scrypt dan plaintext lama (untuk migrasi bertahap).
function verifyPassword(plain, stored) {
  if (typeof stored !== 'string' || stored === '') return false;
  if (!isHashed(stored)) return safeEqual(plain, stored);
  const parts = stored.slice(PREFIX.length).split('$');
  if (parts.length !== 5) return false;
  const [n, r, p, saltHex, hashHex] = parts;
  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(String(plain), Buffer.from(saltHex, 'hex'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p)
    });
    return crypto.timingSafeEqual(actual, expected);
  } catch (e) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword, isHashed };
