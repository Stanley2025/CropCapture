const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/loadTs');
const H = require('../src/shared/harvestPhotos');

// what the real table has after the migration
const PHOTO_COLUMNS = ['id', 'harvest_id', 'farm_id', 'storage_path', 'public_url', 'tag', 'taken_at', 'width', 'height', 'size_bytes', 'upload_status', 'created_at', 'updated_at', 'deleted_at'];

// the database rule from the migration: at most 4 live photos per harvest
const limitRule = (row, rows) => {
  if (row.deleted_at) return null;
  const others = [...rows.values()].filter((r) => r.harvest_id === row.harvest_id && !r.deleted_at && r.id !== row.id);
  return others.length >= 4 ? 'harvest_photo_limit: a harvest can have at most 4 photos' : null;
};

const take = (id, extra = {}) => H.buildPhoto({ harvestId: 'h1', farmId: 'farm1', localUri: `file:///docs/${id}.jpg`, id, ...extra });

test('a photo taken offline stays on the phone, and its record syncs only after the picture is uploaded', async () => {
  const { localDb, syncEngine, server } = loadApp({ columns: { harvest_photos: PHOTO_COLUMNS } });
  server.online = false;

  const photo = take('p1', { tag: 'bags', width: 1200, height: 1600, sizeBytes: 300000 });
  await localDb.saveHarvestPhoto(photo, false);
  assert.equal((await localDb.getHarvestPhotos('h1')).length, 1);
  assert.equal((await localDb.getSyncQueue()).length, 0, 'no record is sent for a picture that is not on the server');

  // the picture file is uploaded: now the record is queued and synced
  server.online = true;
  await localDb.saveHarvestPhoto({ ...photo, upload_status: 'uploaded' }, true);
  const r = await syncEngine.syncQueue();
  assert.equal(r.failureCount, 0);
  const row = [...server.tables.harvest_photos.values()][0];
  assert.deepEqual([row.id, row.harvest_id, row.farm_id, row.storage_path, row.tag, row.upload_status], ['p1', 'h1', 'farm1', 'farm1/h1/p1.jpg', 'bags', 'uploaded']);
  for (const phoneOnly of ['local_uri', 'attempts', 'next_attempt_at', 'last_error', 'uploaded']) assert.ok(!(phoneOnly in row), `${phoneOnly} stays on the phone`);

  await syncEngine.syncQueue();
  assert.equal(server.tables.harvest_photos.size, 1, 'syncing again adds nothing');

  // removing the photo keeps a tombstone on the server and hides it here
  await localDb.deleteHarvestPhoto('p1', true);
  assert.equal((await localDb.getHarvestPhotos('h1')).length, 0);
  await syncEngine.syncQueue();
  assert.ok([...server.tables.harvest_photos.values()][0].deleted_at, 'tombstone');
});

test('a photo that was never uploaded can be removed without telling the server', async () => {
  const { localDb, server } = loadApp({ columns: { harvest_photos: PHOTO_COLUMNS } });
  await localDb.saveHarvestPhoto(take('p2'), false);
  await localDb.deleteHarvestPhoto('p2', false);
  assert.equal((await localDb.getHarvestPhotos()).length, 0);
  assert.equal((await localDb.getSyncQueue()).length, 0);
  assert.equal(server.tables.harvest_photos, undefined);
});

test('a 5th photo is blocked on the phone, and by the server when two phones added photos offline', async () => {
  const { localDb, syncEngine, server } = loadApp({ columns: { harvest_photos: PHOTO_COLUMNS } });
  server.rules = { harvest_photos: limitRule };

  // phone A already synced 4 photos
  for (const n of [1, 2, 3, 4]) server.tables.harvest_photos = (server.tables.harvest_photos || new Map()).set(`a${n}`, { id: `a${n}`, harvest_id: 'h1', deleted_at: null });

  // this phone (B) never saw them, was offline, and took 2 photos
  await localDb.saveHarvestPhoto({ ...take('b1'), upload_status: 'uploaded' }, true);
  await localDb.saveHarvestPhoto({ ...take('b2', { now: new Date(Date.now() + 1000) }), upload_status: 'uploaded' }, true);
  assert.equal(H.canAddPhoto(await localDb.getHarvestPhotos('h1')), true, 'phone B only knows its own 2 photos');

  const r = await syncEngine.syncQueue();
  assert.equal(r.failureCount, 0, 'the farmer is not left with a sync error that can never succeed');
  const live = [...server.tables.harvest_photos.values()].filter((p) => !p.deleted_at);
  assert.equal(live.length, 4, 'the server keeps exactly 4 photos');
  assert.ok(!live.some((p) => p.id.startsWith('b')), 'phone B\'s photos were refused');
  assert.equal((await localDb.getHarvestPhotos('h1')).length, 0, 'and removed from phone B, so it shows what the buyer sees');
  assert.equal((await localDb.getSyncQueue()).filter((q) => q.status !== 'synced').length, 0);
});

test('the 5th photo is blocked on the phone itself', async () => {
  const { localDb } = loadApp({ columns: { harvest_photos: PHOTO_COLUMNS } });
  for (const n of [1, 2, 3, 4]) {
    assert.equal(H.canAddPhoto(await localDb.getHarvestPhotos('h1')), true);
    await localDb.saveHarvestPhoto(take(`p${n}`), false);
  }
  assert.equal(H.canAddPhoto(await localDb.getHarvestPhotos('h1')), false);
});

test('photos from the server are pulled onto another phone, a removed one disappears', async () => {
  const { localDb, syncEngine, server } = loadApp({ columns: { harvest_photos: PHOTO_COLUMNS } });
  await localDb.saveFarm({ id: 'farm1', farmer_id: 'u1', name: 'F', county: 'Bong' }, false);
  const rows = [
    { id: 'r1', harvest_id: 'h1', farm_id: 'farm1', storage_path: 'farm1/h1/r1.jpg', tag: 'heap', upload_status: 'uploaded', created_at: '2026-10-22T00:00:00Z', deleted_at: null },
    { id: 'r2', harvest_id: 'h1', farm_id: 'farm1', storage_path: 'farm1/h1/r2.jpg', tag: 'field', upload_status: 'uploaded', created_at: '2026-10-22T01:00:00Z', deleted_at: '2026-10-23T00:00:00Z' },
  ];
  await localDb.saveHarvestPhoto({ ...take('r2'), upload_status: 'uploaded' }, false); // r2 was here, and was removed elsewhere
  const realFrom = server.client.from;
  server.client.from = (name) => {
    const api = realFrom(name);
    if (name !== 'harvest_photos') return api;
    return { ...api, select: () => { const chain = { eq: () => chain, in: () => chain, then: (resolve) => resolve({ data: rows, error: null }) }; return chain; } };
  };
  await syncEngine.pullUserDelta('u1');
  const photos = await localDb.getHarvestPhotos('h1');
  assert.deepEqual(photos.map((p) => [p.id, p.tag, p.upload_status]), [['r1', 'heap', 'uploaded']]);
});
