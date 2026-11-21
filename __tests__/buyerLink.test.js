const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const L = require('../src/shared/buyerLink');

test('a public code is long, URL-safe and random', () => {
  const code = L.publicCodeFromBytes(crypto.randomBytes(15));
  assert.equal(code.length, 20);
  assert.match(code, /^[A-Za-z0-9_-]{20}$/);
  assert.ok(L.isPublicCode(code));
  const many = new Set(Array.from({ length: 2000 }, () => L.publicCodeFromBytes(crypto.randomBytes(15))));
  assert.equal(many.size, 2000, 'no repeats');
  assert.deepEqual(L.publicCodeFromBytes(Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0])), 'AAAAAAAAAAAA', 'the same bytes always give the same code');
  assert.throws(() => L.publicCodeFromBytes([1, 2, 3]), /random bytes/);
});

test('a code is never built from the farmer, the phone or a counter', () => {
  // the function takes nothing but random bytes, so nothing about the farmer can end up in it
  assert.equal(L.publicCodeFromBytes.length, 1);
  for (const bad of ['12345', 'short', 'has space in it 12345', 'a/b/c/d/e/f/g/h/i/j/k', '', null, undefined, 'x'.repeat(65)]) assert.equal(L.isPublicCode(bad), false, String(bad));
});

test('the buyer link', () => {
  assert.equal(L.buyerUrl('AbCdEfGhIjKlMnOpQrSt'), 'https://farmtori.app/b/AbCdEfGhIjKlMnOpQrSt');
  assert.equal(L.buyerUrl('AbCdEfGhIjKlMnOpQrSt', 'https://admin.example.org/'), 'https://admin.example.org/b/AbCdEfGhIjKlMnOpQrSt');
});

test('scanning: a buyer link, an older /verify/ link, or a typed code or reference', () => {
  assert.deepEqual(L.parseScanned('https://farmtori.app/b/AbCdEfGhIjKlMnOpQrSt'), { kind: 'code', value: 'AbCdEfGhIjKlMnOpQrSt' });
  assert.deepEqual(L.parseScanned('https://farmtori.app/b/AbCdEfGhIjKlMnOpQrSt?x=1'), { kind: 'code', value: 'AbCdEfGhIjKlMnOpQrSt' });
  assert.deepEqual(L.parseScanned('https://farmtori.app/verify/a1b2c3d4e5f6a7b8'), { kind: 'token', value: 'a1b2c3d4e5f6a7b8' });
  assert.deepEqual(L.parseScanned('AbCdEfGhIjKlMnOpQrSt'), { kind: 'code', value: 'AbCdEfGhIjKlMnOpQrSt' });
  assert.equal(L.parseScanned(' LR-BON-GEN-RICE-2026-123456 ').value, 'LR-BON-GEN-RICE-2026-123456', 'a batch reference typed by hand is trimmed')
  assert.deepEqual(L.parseScanned('FT-1'), { kind: 'token', value: 'FT-1' });
});
