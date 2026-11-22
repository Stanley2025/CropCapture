'use strict';
/**
 * PINs for USSD farmers. A PIN is four digits, so it is easy to guess in a few thousand tries: it is
 * therefore only ever checked here on the server, never stored as the digits, kept in a table that
 * the apps cannot read (farmer_pins), and locked after 3 wrong tries.
 */
const crypto = require('node:crypto');

const MAX_ATTEMPTS = 3;
const LOCK_MINUTES = 30;
const PIN_PATTERN = /^\d{4}$/;

/** Optional secret kept in the server's environment (not in the database): makes a stolen database useless. */
const pepperOf = (env = process.env) => String(env.USSD_PIN_PEPPER || '');

function digest(pin, salt, env) {
  const peppered = crypto.createHmac('sha256', pepperOf(env)).update(String(pin)).digest();
  return crypto.scryptSync(peppered, salt, 32, { N: 16384, r: 8, p: 1 });
}

/** "scrypt$<salt>$<hash>" */
function hashPin(pin, env = process.env) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${digest(pin, salt, env).toString('hex')}`;
}

function verifyPin(pin, stored, env = process.env) {
  if (!PIN_PATTERN.test(String(pin)) || typeof stored !== 'string') return false;
  const [kind, saltHex, hashHex] = stored.split('$');
  if (kind !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = digest(pin, Buffer.from(saltHex, 'hex'), env);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/**
 * Is this PIN allowed? Rejects all the same digit (0000), straight runs (1234, 4321) and the PINs people
 * pick first: the last four digits of their phone number, or their birth year.
 * Returns an error text, or null when the PIN is fine.
 */
function weakPinReason(pin, { phone, birthYear } = {}) {
  const p = String(pin);
  if (!PIN_PATTERN.test(p)) return 'Enter exactly 4 digits.';
  const d = p.split('').map(Number);
  if (d.every((x) => x === d[0])) return 'That PIN is too easy to guess. Choose another.';
  const up = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  const down = d.every((x, i) => i === 0 || x === d[i - 1] - 1);
  if (up || down) return 'That PIN is too easy to guess. Choose another.';
  if (phone && String(phone).replace(/\D/g, '').slice(-4) === p) return 'Do not use the end of your phone number.';
  if (birthYear && String(birthYear) === p) return 'Do not use your birth year.';
  return null;
}

/** Is a credential row locked right now? Returns minutes left (rounded up) or 0. */
function lockMinutesLeft(cred, now = new Date()) {
  if (!cred || !cred.locked_until) return 0;
  const left = Date.parse(cred.locked_until) - now.getTime();
  return left > 0 ? Math.ceil(left / 60000) : 0;
}

module.exports = { MAX_ATTEMPTS, LOCK_MINUTES, PIN_PATTERN, hashPin, verifyPin, weakPinReason, lockMinutesLeft };
