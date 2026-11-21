'use strict';
/**
 * The address a buyer opens when they scan a harvest's QR code: {base}/b/{public_code}.
 * The code is random and unguessable. It is never built from a farmer ID, a phone number or a counter.
 */
const DEFAULT_BASE = 'https://farmtori.app';
const CODE_PATTERN = /^[A-Za-z0-9_-]{12,64}$/;

const isPublicCode = (v) => typeof v === 'string' && CODE_PATTERN.test(v);

/** A random code from random bytes (15 bytes give 20 URL-safe characters). The caller supplies the bytes. */
function publicCodeFromBytes(bytes) {
  if (!bytes || bytes.length < 9) throw new Error('At least 9 random bytes are needed');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      out += alphabet[(buffer >> (bits - 6)) & 63];
      bits -= 6;
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += alphabet[(buffer << (6 - bits)) & 63];
  return out;
}

const buyerUrl = (code, base = DEFAULT_BASE) => `${String(base).replace(/\/+$/, '')}/b/${code}`;

/**
 * What a scanner read: a buyer link, an old /verify/ link, or a bare code/reference.
 * Returns { kind: 'code' | 'token', value }.
 */
function parseScanned(raw) {
  const text = String(raw || '').trim();
  const link = text.match(/\/b\/([A-Za-z0-9_-]+)/);
  if (link && isPublicCode(link[1])) return { kind: 'code', value: link[1] };
  const old = text.match(/\/verify\/([^/?#\s]+)/);
  if (old) return { kind: 'token', value: decodeURIComponent(old[1]) };
  return isPublicCode(text) ? { kind: 'code', value: text } : { kind: 'token', value: text };
}

module.exports = { DEFAULT_BASE, CODE_PATTERN, isPublicCode, publicCodeFromBytes, buyerUrl, parseScanned };
