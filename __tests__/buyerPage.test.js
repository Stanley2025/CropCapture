const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadAdmin } = require('./helpers/loadAdminTs');

const H = loadAdmin('lib/buyer/handlers.ts');
const P = loadAdmin('lib/buyer/page.ts');

const CODE = 'AbCdEfGhIjKlMnOpQrSt';

/** What get_buyer_page() returns, plus private extras a careless change to the function might add. */
const row = (extra = {}) => ({
  harvest_id: 'harvest-internal-uuid',
  batch_id: 'LR-BON-GEN-RICE-2026-123456',
  crop: 'Rice',
  variety: 'Suakoko 8',
  quantity: 2450,
  unit: 'kg',
  harvest_date: '2026-10-22',
  approved: true,
  district: 'Suakoko',
  county: 'Bong',
  farmer: 'Emmanuel G.',
  photos: [
    { id: 'p1', path: 'farm1/h1/p1.jpg', tag: 'bags' },
    { id: 'p2', path: 'farm1/h1/p2.jpg', tag: 'grain' },
  ],
  activities: [
    { type: 'Seed sowing', date: '2026-05-02' },
    { type: 'Weeding', date: '2026-07-11' },
  ],
  // never shown, even if the database function returned them by mistake
  phone_number: '+231-77-PRIVATE-PHONE', latitude: 7.123456, longitude: -9.654321, boundary: 'PRIVATE-BOUNDARY', national_id: 'PRIVATE-NATIONAL-ID',
  total_value: 99999, unit_price: 77777, cost: 31337, profit: 4242, weather_sky: 'PRIVATE-WEATHER', rain_mm: 12, description: 'PRIVATE-NOTE', observations: 'PRIVATE-OBS',
  farmer_id: 'PRIVATE-farmer-uuid', user_id: 'PRIVATE-user-uuid', qr_token: 'PRIVATE-qr-token', full_name: 'Emmanuel Kollie Gaye',
  ...extra,
});

const NEVER_SHOWN = ['PRIVATE', '+231', '7.123456', '-9.654321', '99999', '77777', '31337', '4242', 'harvest-internal-uuid', 'Kollie', 'Emmanuel Kollie'];

function fakeClient({ data = row(), rpcError = null, signError = null } = {}) {
  const calls = { rpc: [], signed: [], inserts: [] };
  const client = {
    calls,
    rpc: async (name, args) => {
      calls.rpc.push([name, args]);
      if (name === 'get_buyer_page') return { data: rpcError ? null : args.p_code === CODE ? data : null, error: rpcError };
      if (name === 'public_code_for_token') return { data: args.p_token === 'old-token-123' ? CODE : null, error: null };
      return { data: null, error: { message: 'unknown function' } };
    },
    from: (table) => ({ insert: async (value) => { calls.inserts.push([table, value]); return { error: null }; } }),
    storage: {
      from: (bucket) => ({
        createSignedUrls: async (paths, seconds) => {
          calls.signed.push({ bucket, paths, seconds });
          if (signError) return { data: null, error: signError };
          return { data: paths.map((p) => ({ path: p, signedUrl: `https://x.supabase.co/storage/v1/object/sign/${bucket}/${p}?token=T-${p.length}`, error: null })), error: null };
        },
      }),
    },
  };
  return client;
}
const limiter = () => H.createRateLimiter({ limit: 1000, windowMs: 60000 });
const get = (client, code = CODE, extra = {}) => H.getBuyerPage({ code, ip: '1.1.1.1', ...extra }, { client, limiter: limiter() });

test('the page shows the facts, the photos, the activities and the footer note', async () => {
  const client = fakeClient();
  const r = await get(client);
  assert.equal(r.status, 200);
  for (const want of ['Rice · Suakoko 8', 'LR-BON-GEN-RICE-2026-123456', '2,450 kg', '22 Oct 2026', 'Suakoko, Bong', 'Emmanuel G.', 'Seed sowing', '2 May 2026', 'Weeding', 'Approved', 'Report a problem',
    'These details and photos were entered by the farmer. Ask the farmer, or your own inspector, if you need to check them.']) {
    assert.ok(r.body.includes(want), `missing: ${want}`);
  }
  assert.equal((r.body.match(/<img /g) || []).length, 2);
  assert.ok(r.body.includes('loading="lazy"'), 'photos are lazy-loaded');
  assert.ok(r.body.includes('Bags') && r.body.includes('Grain'), 'photo tags');
});

test('NEVER SHOWN: the full page and the JSON contain none of the private fields', async () => {
  const client = fakeClient();
  const page = await get(client);
  const data = await H.getBuyerJson({ code: CODE, ip: '1.1.1.1' }, { client, limiter: limiter() });
  for (const reply of [page, data]) {
    for (const secret of NEVER_SHOWN) assert.ok(!reply.body.includes(secret), `leaked: ${secret}`);
  }
  assert.deepEqual(Object.keys(JSON.parse(data.body)).sort(), ['activities', 'approved', 'batchId', 'county', 'crop', 'district', 'farmer', 'harvestDate', 'photos', 'quantity', 'unit', 'variety']);
  const photoKeys = Object.keys(JSON.parse(data.body).photos[0]).sort();
  assert.deepEqual(photoKeys, ['id', 'tag', 'url'], 'no storage path is returned');
  assert.ok(!page.body.includes('farm1/h1/p1.jpg?') || page.body.includes('/sign/'), 'photos are only reachable through a signed link');
  assert.ok(!/<script/i.test(page.body), 'no scripts');
});

test('"Approved" appears only when an inspector approved the batch', async () => {
  const approved = await get(fakeClient({ data: row({ approved: true }) }));
  assert.ok(approved.body.includes('Approved') && !approved.body.includes('Awaiting approval'));
  for (const value of [false, undefined, null, 'true', 1]) {
    const r = await get(fakeClient({ data: row({ approved: value }) }));
    assert.ok(!r.body.includes('>Approved<'), `approved=${String(value)}`);
    assert.ok(r.body.includes('Awaiting approval'));
  }
});

test('photo links are signed and last 10 minutes; a raw storage path is never put on the page', async () => {
  const client = fakeClient();
  const r = await get(client);
  assert.equal(client.calls.signed.length, 1);
  assert.equal(client.calls.signed[0].seconds, 600);
  assert.equal(client.calls.signed[0].bucket, 'harvest-photos');
  const srcs = [...r.body.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  assert.equal(srcs.length, 2);
  for (const src of srcs) assert.match(src, /\/object\/sign\/harvest-photos\/.+\?token=/, 'a signed link');
  assert.ok(!r.body.includes('/object/public/'), 'no public bucket address');
});

test('the migration makes the bucket private and gives the app key no way to read or list photos', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/20261126_harvest_photos_traceability.sql'), 'utf8');
  assert.match(sql, /'harvest-photos', 'harvest-photos', false, 1048576, ARRAY\['image\/jpeg'\]/, 'private, 1 MB, jpeg only');
  const policies = sql.split(/CREATE POLICY/).slice(1).filter((p) => /storage\.objects/.test(p.split(';')[0]) || /bucket_id = 'harvest-photos'/.test(p));
  const anonReads = policies.filter((p) => /FOR (SELECT|UPDATE|DELETE|ALL)/.test(p) && /anon/.test(p.split('USING')[0].split('WITH CHECK')[0]));
  assert.equal(anonReads.length, 0, 'anon can only insert');
  const insert = policies.find((p) => /FOR INSERT/.test(p));
  assert.match(insert, /\[0-9a-f\]\{8\}-.*\.jpg\$/s, 'the path must have the exact shape {uuid}/{uuid}/{uuid}.jpg');
  assert.ok(!/GRANT EXECUTE ON FUNCTION public\.get_buyer_page\(TEXT\) TO (anon|authenticated|PUBLIC)/i.test(sql), 'only the server role may call the buyer function');
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_buyer_page\(TEXT\) TO service_role/);
});

test('unknown, malformed and removed codes give the same page and the same status', async () => {
  const client = fakeClient();
  const replies = [];
  for (const code of ['ZZZZZZZZZZZZZZZZZZZZ', 'short', '../../etc/passwd', 'has space in the code', '', 'x'.repeat(200), "' or 1=1 --", '%00']) replies.push(await get(client, code));
  const byDb = await get(fakeClient({ rpcError: { message: 'boom' } })); // a database error looks the same too
  const noKey = await get(null); // a server without its key looks the same too
  const all = [...replies, byDb, noKey];
  for (const r of all) {
    assert.equal(r.status, 404);
    assert.equal(r.body, all[0].body, 'the same body');
  }
  assert.ok(all[0].body.includes('Product not found'));
  assert.ok(!all[0].body.includes('ZZZZ'), 'the code is not repeated back');
  const asked = client.calls.rpc.length;
  assert.equal(asked, 1, 'a malformed code never reaches the database');
  const json404 = await H.getBuyerJson({ code: 'nope', ip: '1.1.1.1' }, { client, limiter: limiter() });
  assert.equal(json404.status, 404);
});

test('a removed harvest looks like an unknown code', async () => {
  // the database function returns null for a harvest that was removed
  const r = await get(fakeClient({ data: null }));
  assert.equal(r.status, 404);
  assert.ok(r.body.includes('Product not found'));
});

test('requests are rate-limited per IP', async () => {
  const client = fakeClient();
  let now = 0;
  const lim = H.createRateLimiter({ limit: 3, windowMs: 60000, now: () => now });
  const ask = (ip) => H.getBuyerPage({ code: CODE, ip }, { client, limiter: lim });
  assert.deepEqual([(await ask('9.9.9.9')).status, (await ask('9.9.9.9')).status, (await ask('9.9.9.9')).status], [200, 200, 200]);
  const blocked = await ask('9.9.9.9');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers['Retry-After'], '60');
  assert.equal((await ask('8.8.8.8')).status, 200, 'another visitor is not affected');
  now = 61000;
  assert.equal((await ask('9.9.9.9')).status, 200, 'allowed again after a minute');
});

test('the page works on a slow network: facts first, no scripts, photos optional, small', async () => {
  const r = await get(fakeClient({ signError: { message: 'storage unreachable' } }));
  assert.equal(r.status, 200, 'photos failing does not stop the page');
  assert.ok(r.body.includes('No photos added yet'));
  assert.ok(r.body.includes('2,450 kg') && r.body.includes('Seed sowing'));
  assert.ok(!/<script|<link[^>]+stylesheet|@import|https?:\/\/[^"' ]+\.(js|css)/i.test(r.body), 'one inline stylesheet, nothing else to download');
  assert.ok(Buffer.byteLength(r.body) < 300 * 1024, 'under 300 KB');
  assert.ok(Buffer.byteLength(r.body) < 20 * 1024, `and in fact ${Buffer.byteLength(r.body)} bytes`);
  const withPhotos = await get(fakeClient());
  assert.ok(withPhotos.body.indexOf('Facts') > withPhotos.body.indexOf('<img'), 'photos are lazy-loaded images, the facts are in the HTML itself');
});

test('headers: not listed by search engines, not stored, no referrer, locked-down content policy', async () => {
  const r = await get(fakeClient());
  assert.equal(r.headers['X-Robots-Tag'], 'noindex, nofollow');
  assert.equal(r.headers['Cache-Control'], 'private, no-store');
  assert.equal(r.headers['Referrer-Policy'], 'no-referrer');
  assert.match(r.headers['Content-Security-Policy'], /default-src 'none'/);
  assert.match(r.body, /<meta name="robots" content="noindex,nofollow">/);
  const nf = await get(fakeClient(), 'nope');
  assert.equal(nf.headers['X-Robots-Tag'], 'noindex, nofollow');
});

test('link previews: Open Graph title with the crop and batch ID', async () => {
  const r = await get(fakeClient());
  assert.match(r.body, /<title>Rice · Batch LR-BON-GEN-RICE-2026-123456<\/title>/);
  assert.match(r.body, /<meta property="og:title" content="Rice · Batch LR-BON-GEN-RICE-2026-123456">/);
  assert.match(r.body, /<meta property="og:description" content="2,450 kg harvested on 22 Oct 2026\./);
  assert.ok(!r.body.includes('og:image'), 'no image address in the preview: photo links expire');
});

test('text from the farmer is escaped', async () => {
  const r = await get(fakeClient({ data: row({ crop: '<script>alert(1)</script>', activities: [{ type: '"><img src=x onerror=alert(1)>', date: '2026-05-02' }], farmer: '<b>Evil</b>' }) }));
  assert.ok(!r.body.includes('<script>alert(1)'));
  assert.ok(!r.body.includes('<img src=x'));
  assert.ok(!r.body.includes('<b>Evil'));
  assert.ok(r.body.includes('&lt;script&gt;'));
});

test('report a problem: stored for admin review, same answer whatever the code or input', async () => {
  const client = fakeClient();
  const send = (over = {}) => H.postReport({ code: CODE, ip: '2.2.2.2', message: 'The photo does not match the product', contact: '0777000111', website: '', ...over }, { client, limiter: H.createRateLimiter({ limit: 100, windowMs: 1000 }) });

  const ok = await send();
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.Location, `/b/${CODE}?reported=1`);
  assert.deepEqual(client.calls.inserts, [['buyer_reports', { harvest_id: 'harvest-internal-uuid', public_code: CODE, message: 'The photo does not match the product', contact: '0777000111' }]]);

  await send({ contact: '' });
  assert.equal(client.calls.inserts[1][1].contact, null, 'the contact is optional');

  const before = client.calls.inserts.length;
  for (const bad of [{ website: 'http://spam' }, { message: 'x' }, { message: 'y'.repeat(1001) }, { message: 42 }]) assert.equal((await send(bad)).status, 303);
  assert.equal(client.calls.inserts.length, before, 'spam, too short, too long: nothing stored, same answer');

  const unknown = await H.postReport({ code: 'ZZZZZZZZZZZZZZZZZZZZ', ip: '2.2.2.2', message: 'hello there', contact: '', website: '' }, { client, limiter: H.createRateLimiter({ limit: 100, windowMs: 1000 }) });
  assert.equal(unknown.status, 303, 'an unknown code cannot be told apart');
  assert.equal(client.calls.inserts.length, before);
  assert.equal((await H.postReport({ code: 'bad', ip: 'x', message: 'hello there' }, { client })).status, 404);

  const lim = H.createRateLimiter({ limit: 2, windowMs: 600000 });
  const flood = [];
  for (let i = 0; i < 3; i++) flood.push((await H.postReport({ code: CODE, ip: '3.3.3.3', message: 'hello there' }, { client, limiter: lim })).status);
  assert.deepEqual(flood, [303, 303, 429], 'reports are rate-limited');

  const page = await H.getBuyerPage({ code: CODE, ip: '1.1.1.1', reported: true }, { client, limiter: limiter() });
  assert.ok(page.body.includes('Thank you. Your report was sent for review.'));
  assert.ok(!page.body.includes('<form'), 'the form is replaced by the thank-you');
});

test('the older /verify/{token} address redirects to the new page', async () => {
  const client = fakeClient();
  const ok = await H.legacyRedirect('old-token-123', '1.1.1.1', { client, limiter: limiter() });
  assert.equal(ok.status, 302);
  assert.equal(ok.headers.Location, `/b/${CODE}`);
  const unknown = await H.legacyRedirect('who-knows', '1.1.1.1', { client, limiter: limiter() });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body, (await get(client, 'nope')).body, 'the same generic page');
});

test('no word the brief forbids in the page text, the code or the migration', () => {
  const files = ['admin/src/lib/buyer/en.ts', 'admin/src/lib/buyer/page.ts', 'admin/src/lib/buyer/handlers.ts', 'src/shared/harvestPhotos.js', 'src/shared/buyerLink.js', 'src/components/buyer/BuyerPage.tsx', 'app/harvest-photos/[id].tsx', 'app/traceability/[token].tsx', 'src/services/photos/harvestPhotoService.ts', 'supabase/migrations/20261126_harvest_photos_traceability.sql'];
  const banned = /verified|tamper-proof|cryptographic|guaranteed|certified/i;
  for (const f of files) assert.ok(!banned.test(fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8')), f);
  const en = fs.readFileSync(path.resolve(__dirname, '../src/i18n/en.ts'), 'utf8');
  assert.ok(!banned.test(en), 'src/i18n/en.ts');
});
