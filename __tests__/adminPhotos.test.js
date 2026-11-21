const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadAdmin } = require('./helpers/loadAdminTs');

const A = loadAdmin('lib/buyer/adminPhotos.ts');

const PHOTO = '11111111-1111-4111-8111-111111111111';
const HARVEST = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';
const FARMER = '44444444-4444-4444-8444-444444444444';

/** A fake server client that records every call in order. */
function fakeClient({ roles = { [ADMIN]: 'agricultural_admin', [FARMER]: 'farmer' }, auditFails = false } = {}) {
  const log = [];
  const photos = new Map([[PHOTO, { id: PHOTO, harvest_id: HARVEST, farm_id: 'farm1', tag: 'bags', storage_path: `farm1/${HARVEST}/${PHOTO}.jpg`, size_bytes: 1000, created_at: '2026-10-22T00:00:00Z', deleted_at: null }]]);
  const query = (table) => {
    const filters = {};
    const q = {
      select: () => q,
      eq: (c, v) => { filters[c] = v; return q; },
      is: (c, v) => { filters[`${c}:is`] = v; return q; },
      order: () => q,
      maybeSingle: async () => {
        if (table === 'profiles') return { data: roles[filters.id] ? { role: roles[filters.id] } : null };
        const row = photos.get(filters.id);
        return { data: row && !row.deleted_at ? row : null };
      },
      then: (resolve) => resolve({ data: [...photos.values()].filter((p) => !p.deleted_at && (!filters.harvest_id || p.harvest_id === filters.harvest_id)), error: null }),
      insert: async (value) => { log.push(['insert', table, value]); return { error: auditFails ? { message: 'down' } : null }; },
      update: (value) => ({
        eq: (c, v) => ({
          is: async () => { log.push(['update', table, value]); Object.assign(photos.get(v), value); return { error: null }; },
        }),
      }),
    };
    return q;
  };
  return {
    log,
    photos,
    from: (table) => query(table),
    rpc: async () => ({ data: null, error: null }),
    storage: { from: () => ({ createSignedUrls: async (paths, s) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://x/sign/${p}?token=T&s=${s}`, error: null })), error: null }), remove: async (paths) => { log.push(['storage.remove', paths]); return {}; } }) },
  };
}
const deps = (client, userId = ADMIN) => ({ client, getUser: async () => (userId ? { id: userId } : null), now: () => new Date('2026-11-22T10:00:00Z') });

test('only a signed-in administrator can list or remove photos', async () => {
  const client = fakeClient();
  assert.equal((await A.listHarvestPhotos(HARVEST, deps(client, null))).status, 401, 'not signed in');
  assert.equal((await A.listHarvestPhotos(HARVEST, deps(client, FARMER))).status, 403, 'a farmer is not an administrator');
  assert.equal((await A.listHarvestPhotos(HARVEST, deps(client, 'someone-else'))).status, 403, 'a user with no profile');
  assert.equal((await A.removeHarvestPhoto({ photoId: PHOTO, reason: 'not a crop photo' }, deps(client, null))).status, 401);
  assert.equal((await A.removeHarvestPhoto({ photoId: PHOTO, reason: 'not a crop photo' }, deps(client, FARMER))).status, 403);
  assert.equal((await A.removeHarvestPhoto({ photoId: PHOTO, reason: 'not a crop photo' }, deps(null))).status, 503, 'no server key: nothing is done');
  assert.equal(client.log.length, 0, 'nothing was changed by any of these');
});

test('an administrator sees the photos with links that expire', async () => {
  const r = await A.listHarvestPhotos(HARVEST, deps(fakeClient()));
  assert.equal(r.status, 200);
  const body = JSON.parse(r.body);
  assert.equal(body.photos.length, 1);
  assert.match(body.photos[0].url, /sign\/farm1\/.+\?token=T&s=600/);
  assert.equal((await A.listHarvestPhotos('not-a-uuid', deps(fakeClient()))).status, 400);
});

test('removing a photo needs a written reason, is written to the audit log first, and removes the file', async () => {
  const client = fakeClient();
  assert.equal((await A.removeHarvestPhoto({ photoId: PHOTO, reason: '' }, deps(client))).status, 400);
  assert.equal((await A.removeHarvestPhoto({ photoId: PHOTO, reason: 'ab' }, deps(client))).status, 400);
  assert.equal((await A.removeHarvestPhoto({ photoId: PHOTO, reason: 'x'.repeat(301) }, deps(client))).status, 400);
  assert.equal((await A.removeHarvestPhoto({ photoId: 'nope', reason: 'valid reason' }, deps(client))).status, 400);
  assert.equal(client.log.length, 0, 'no reason, no change');

  const r = await A.removeHarvestPhoto({ photoId: PHOTO, reason: 'Shows a person, not the product', ip: '5.5.5.5' }, deps(client));
  assert.equal(r.status, 200);
  assert.deepEqual(client.log.map((e) => e[0]), ['insert', 'update', 'storage.remove'], 'order: audit, hide, delete the file');

  const audit = client.log[0][2];
  assert.equal(audit.user_id, ADMIN, 'who');
  assert.equal(audit.entity_id, PHOTO, 'which photo');
  assert.equal(audit.action, 'harvest_photo_removed_by_admin');
  assert.equal(audit.details.harvest_id, HARVEST, 'of which harvest');
  assert.equal(audit.details.removed_at, '2026-11-22T10:00:00.000Z', 'when');
  assert.equal(audit.details.reason, 'Shows a person, not the product', 'why');
  assert.equal(audit.ip_address, '5.5.5.5');

  assert.deepEqual(client.log[1][2], { deleted_at: '2026-11-22T10:00:00.000Z', updated_at: '2026-11-22T10:00:00.000Z' }, 'only a tombstone: nothing else on the farmer\'s record is edited');
  assert.deepEqual(client.log[2][1], [`farm1/${HARVEST}/${PHOTO}.jpg`]);

  assert.equal((await A.removeHarvestPhoto({ photoId: PHOTO, reason: 'again please' }, deps(client))).status, 404, 'already removed');
});

test('if the audit record cannot be written, the photo is not removed', async () => {
  const client = fakeClient({ auditFails: true });
  const r = await A.removeHarvestPhoto({ photoId: PHOTO, reason: 'breaks the rules' }, deps(client));
  assert.equal(r.status, 500);
  assert.deepEqual(client.log.map((e) => e[0]), ['insert'], 'no hiding, no file removal');
  assert.equal(client.photos.get(PHOTO).deleted_at, null);
});

test('the audit trail: harvest changes and photo events are logged by the database', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/20261127_harvest_audit_trail.sql'), 'utf8');
  for (const want of ['OLD.quantity IS DISTINCT FROM NEW.quantity', 'OLD.harvest_date IS DISTINCT FROM NEW.harvest_date', "'harvest_changed'", "'harvest_photo_added'", "'harvest_photo_removed'", 'AFTER UPDATE ON public.harvest_batches']) assert.ok(sql.includes(want), want);
  assert.ok(!/DELETE FROM public\.audit_logs|TRUNCATE/i.test(sql), 'history is never removed');
  const all = fs.readFileSync(path.resolve(__dirname, '../supabase/apply_all_pending.sql'), 'utf8');
  assert.ok(all.includes('20261126_harvest_photos_traceability') && all.includes('20261127_harvest_audit_trail'), 'both are in the one-paste script');
});
