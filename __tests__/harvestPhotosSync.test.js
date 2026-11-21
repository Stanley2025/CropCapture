const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/loadTs');
const H = require('../src/shared/harvestPhotos');

const PHOTO_COLUMNS = ['id', 'harvest_id', 'farm_id', 'storage_path', 'public_url', 'created_at', 'updated_at', 'deleted_at'];

test('a photo taken offline stays on the phone, and its record syncs only after the picture is uploaded', async () => {
  const { localDb, syncEngine, server } = loadApp({ columns: { harvest_photos: PHOTO_COLUMNS } });
  server.online = false;

  // taken with no connection: saved on the phone, nothing queued yet (the picture has not been sent)
  const photo = H.buildPhoto({ harvestId: 'h1', farmId: 'farm1', localUri: 'file:///docs/harvest-photos/p1.jpg', id: 'p1' });
  await localDb.saveHarvestPhoto(photo, false);
  assert.equal((await localDb.getHarvestPhotos('h1')).length, 1);
  assert.equal((await localDb.getSyncQueue()).length, 0, 'no record is sent for a picture that is not on the server');

  // the connection returns and the picture file is uploaded: now the record is queued and synced
  server.online = true;
  await localDb.saveHarvestPhoto({ ...photo, uploaded: true, public_url: 'https://x/storage/v1/object/public/harvest-photos/h1/p1.jpg' }, true);
  const r = await syncEngine.syncQueue();
  assert.equal(r.failureCount, 0);
  assert.equal(server.tables.harvest_photos.size, 1);
  const row = [...server.tables.harvest_photos.values()][0];
  assert.deepEqual([row.id, row.harvest_id, row.storage_path], ['p1', 'h1', 'h1/p1.jpg']);
  assert.ok(!('local_uri' in row) && !('uploaded' in row), 'phone-only fields never reach the server');

  // syncing again adds nothing
  await syncEngine.syncQueue();
  assert.equal(server.tables.harvest_photos.size, 1);

  // removing the photo keeps a tombstone on the server and hides it here
  await localDb.deleteHarvestPhoto('p1', true);
  assert.equal((await localDb.getHarvestPhotos('h1')).length, 0);
  await syncEngine.syncQueue();
  assert.ok([...server.tables.harvest_photos.values()][0].deleted_at, 'tombstone');
  assert.equal(server.tables.harvest_photos.size, 1);
});

test('a photo that was never uploaded can be removed without telling the server', async () => {
  const { localDb, server } = loadApp({ columns: { harvest_photos: PHOTO_COLUMNS } });
  const photo = H.buildPhoto({ harvestId: 'h1', localUri: 'file:///a.jpg', id: 'p2' });
  await localDb.saveHarvestPhoto(photo, false);
  await localDb.deleteHarvestPhoto('p2', false);
  assert.equal((await localDb.getHarvestPhotos()).length, 0);
  assert.equal((await localDb.getSyncQueue()).length, 0);
  assert.equal(server.tables.harvest_photos, undefined);
});
