const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../src/shared/harvestPhotos');

const HARVEST = {
  id: 'h1', farm_id: 'farm1', season_id: 's1', batch_reference: 'LR-BON-GEN-RICE-2026-123456', crop_variety_id: 'Suakoko 8',
  quantity: 250, unit: 'kg', harvest_date: '2026-10-22', status: 'approved', qr_token: 'PRIVATE-qr-token', public_code: 'PRIVATE-public-code', farmer_id: 'farmer-private-id',
  total_value: 99999, unit_price: 77777, storage_location: 'PRIVATE-STORE', observations: 'PRIVATE-OBS', photo_url: null,
};
const FARM = { id: 'farm1', name: 'Kollie Rice Farm', county: 'Bong', district: 'Suakoko', community: 'PRIVATE-COMMUNITY', latitude: 7.123456, longitude: -9.654321, boundary: 'PRIVATE-BOUNDARY', farmer_id: 'farmer-private-id' };
const FARMER = { id: 'farmer-private-id', full_name: 'Emmanuel Kollie Gaye', phone_number: '+231-77-PRIVATE-PHONE', national_id: 'PRIVATE-NATIONAL-ID' };
const act = (date, type, extra = {}) => ({ id: `a-${date}-${type}`, farm_id: 'farm1', activity_type: type, activity_date: date, description: 'PRIVATE-NOTE 0777123456', cost: 31337, labor_count: 9, recorded_by: 'user-private', farmer_id: 'farmer-private-id', ...extra });
const photo = (n, created, extra = {}) => ({ id: `p${n}`, harvest_id: 'h1', created_at: created, deleted_at: null, tag: 'bags', local_uri: `file:///p${n}.jpg`, ...extra });

test('a new photo is saved on the phone first, with its place in the private bucket', () => {
  const p = H.buildPhoto({ harvestId: 'h1', farmId: 'farm1', localUri: 'file:///a.jpg', tag: 'grain', now: new Date('2026-11-21T10:00:00Z'), id: 'p1' });
  assert.equal(p.storage_path, 'farm1/h1/p1.jpg', 'harvest-photos/{farm_id}/{harvest_id}/{photo_id}.jpg');
  assert.deepEqual([p.tag, p.upload_status, p.public_url, p.deleted_at, p.local_uri], ['grain', 'pending', null, null, 'file:///a.jpg']);
  assert.equal(p.taken_at, '2026-11-21T10:00:00.000Z');
  assert.equal(H.buildPhoto({ harvestId: 'h1', farmId: 'f', localUri: 'x', tag: 'nonsense' }).tag, 'other', 'an unknown tag becomes other');
  assert.throws(() => H.buildPhoto({ farmId: 'f', localUri: 'x' }), /Harvest/);
  assert.throws(() => H.buildPhoto({ harvestId: 'h1', localUri: 'x' }), /Farm/);
  assert.throws(() => H.buildPhoto({ harvestId: 'h1', farmId: 'f' }), /file/);
});

test('only the picture record goes to the server, not the phone-only fields', () => {
  const row = H.toServerRow(H.buildPhoto({ harvestId: 'h1', farmId: 'farm1', localUri: 'file:///a.jpg', id: 'p1', width: 1200, height: 1600, sizeBytes: 300000 }));
  assert.deepEqual(Object.keys(row).sort(), [
    'created_at', 'deleted_at', 'farm_id', 'harvest_id', 'height', 'id', 'public_url', 'size_bytes', 'storage_path', 'tag', 'taken_at', 'updated_at', 'upload_status', 'width',
  ]);
});

test('a harvest holds at most 4 photos; removed photos do not count', () => {
  const photos = (n) => Array.from({ length: n }, (_, i) => ({ id: String(i), deleted_at: null }));
  assert.equal(H.MAX_PHOTOS_PER_HARVEST, 4);
  assert.equal(H.canAddPhoto(photos(3)), true);
  assert.equal(H.canAddPhoto(photos(4)), false, 'a 5th photo is blocked');
  assert.equal(H.canAddPhoto([...photos(4).slice(1), { id: 'gone', deleted_at: 'x' }]), true);
});

test('two phones add photos offline: the oldest 4 stay, and both phones pick the same ones', () => {
  const phoneA = [photo(1, '2026-10-22T08:00:00Z'), photo(2, '2026-10-22T09:00:00Z'), photo(3, '2026-10-22T10:00:00Z')];
  const phoneB = [photo(4, '2026-10-22T08:30:00Z'), photo(5, '2026-10-22T11:00:00Z')];
  const dropA = H.photosOverLimit([...phoneA, ...phoneB]).map((p) => p.id);
  const dropB = H.photosOverLimit([...phoneB, ...phoneA]).map((p) => p.id);
  assert.deepEqual(dropA, ['p5']);
  assert.deepEqual(dropB, dropA);
  assert.deepEqual(H.photosOverLimit(phoneA), [], 'within the limit nothing is dropped');
  assert.deepEqual(H.photosOverLimit([...phoneA, photo(9, '2026-10-23T00:00:00Z', { deleted_at: 'x' }), phoneB[0]]), [], 'removed photos do not count');
});

// --- compression ----------------------------------------------------------------------------------

test('resize: the longest side becomes 1600 px, small pictures are left alone', () => {
  assert.deepEqual(H.planResize(4000, 3000), { width: 1600, height: 1200 });
  assert.deepEqual(H.planResize(3000, 4000), { width: 1200, height: 1600 });
  assert.equal(H.planResize(1600, 900), null);
  assert.equal(H.planResize(0, 0), null);
});

test('compression starts at quality 0.7 and lowers it until the file is under 400 KB', async () => {
  const tried = [];
  const encode = async (quality) => { tried.push(quality); return { size: Math.round(900000 * quality) }; }; // a photo that is 630 KB at 0.7
  const out = await H.compressToTarget(encode);
  assert.deepEqual(tried, [0.7, 0.6, 0.5, 0.4]);
  assert.equal(out.quality, 0.4);
  assert.ok(out.size < H.TARGET_BYTES && out.withinTarget && out.withinServerLimit);

  const easy = await H.compressToTarget(async () => ({ size: 100000 }));
  assert.equal(easy.quality, 0.7, 'a small picture is encoded once, at 0.7');

  const huge = await H.compressToTarget(async (q) => ({ size: Math.round(5000000 * q) }));
  assert.equal(huge.withinTarget, false);
  assert.equal(huge.withinServerLimit, false, 'a file the server would refuse is reported, not sent');
});

// A small JPEG with the blocks a phone camera writes: JFIF (APP0), Exif with GPS (APP1), a colour profile (APP2), IPTC (APP13), a comment.
function jpegWith(...blocks) {
  const seg = (marker, payload) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 255, ...payload];
  const bytes = (text) => [...Buffer.from(text, 'latin1')];
  const image = [0xff, 0xdb, 0x00, 0x04, 0x01, 0x02, 0xff, 0xda, 0x00, 0x03, 0x01, 0x11, 0x22, 0x33, 0x44, 0xff, 0xd9];
  const all = { jfif: seg(0xe0, bytes('JFIF\0')), exif: seg(0xe1, bytes('Exif\0\0GPSLatitude=6.3 GPSLongitude=-10.8')), icc: seg(0xe2, bytes('ICC_PROFILE')), iptc: seg(0xed, bytes('Photoshop 3.0 caption')), comment: seg(0xfe, bytes('shot at the farm gate')) };
  return Uint8Array.from([0xff, 0xd8, ...blocks.flatMap((b) => all[b]), ...image]);
}
const text = (u8) => Buffer.from(u8).toString('latin1');

test('stripping removes Exif (GPS), IPTC and comments but keeps the picture and colour data', () => {
  const original = jpegWith('jfif', 'exif', 'icc', 'iptc', 'comment');
  assert.ok(H.hasExif(original));
  assert.match(text(original), /GPSLatitude/);

  const clean = H.stripJpegMetadata(original);
  assert.equal(H.hasExif(clean), false);
  const t = text(clean);
  assert.ok(!/GPS|Exif|Photoshop|farm gate/.test(t), 'no location, camera or caption text is left');
  assert.ok(/JFIF/.test(t) && /ICC_PROFILE/.test(t), 'JFIF and colour profile are kept');
  assert.deepEqual([...clean.slice(0, 2)], [0xff, 0xd8]);
  assert.deepEqual([...clean.slice(-11)], [0xff, 0xda, 0x00, 0x03, 0x01, 0x11, 0x22, 0x33, 0x44, 0xff, 0xd9], 'the image data is untouched');
  assert.ok(clean.length < original.length);
});

test('stripping is safe on other data and on a picture that has no metadata', () => {
  const notJpeg = Uint8Array.from([1, 2, 3, 4, 5]);
  assert.deepEqual([...H.stripJpegMetadata(notJpeg)], [1, 2, 3, 4, 5]);
  const plain = jpegWith('jfif');
  assert.deepEqual([...H.stripJpegMetadata(plain)], [...plain]);
});

// --- upload queue ---------------------------------------------------------------------------------

test('the upload queue: Wi-Fi only by default, mobile data when allowed, nothing offline', () => {
  const p = { upload_status: 'pending', deleted_at: null, next_attempt_at: null };
  const wifi = { connected: true, wifi: true };
  const mobile = { connected: true, wifi: false };
  const none = { connected: false, wifi: false };
  assert.equal(H.nextUploadAction({ photo: p, network: wifi, wifiOnly: true }), 'upload');
  assert.equal(H.nextUploadAction({ photo: p, network: mobile, wifiOnly: true }), 'wait_wifi', 'no upload on mobile data when the setting is off');
  assert.equal(H.nextUploadAction({ photo: p, network: mobile, wifiOnly: false }), 'upload');
  assert.equal(H.nextUploadAction({ photo: p, network: none, wifiOnly: false }), 'wait_connection');
  assert.equal(H.nextUploadAction({ photo: { ...p, upload_status: 'uploaded' }, network: wifi }), 'skip');
  assert.equal(H.nextUploadAction({ photo: { ...p, deleted_at: 'x' }, network: wifi }), 'skip');
});

test('after a failure the photo waits, with a growing delay, and then tries again', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(H.backoffMs), [30000, 60000, 120000, 240000, 480000]);
  assert.equal(H.backoffMs(20), 3600000, 'never more than an hour');
  const now = Date.parse('2026-11-21T10:00:00Z');
  const failed = { upload_status: 'failed', deleted_at: null, attempts: 1, next_attempt_at: new Date(now + 30000).toISOString() };
  const net = { connected: true, wifi: true };
  assert.equal(H.nextUploadAction({ photo: failed, network: net, now }), 'wait_retry');
  assert.equal(H.nextUploadAction({ photo: failed, network: net, now: now + 31000 }), 'upload');
});

test('after the app is closed during an upload, that photo goes back to the queue', () => {
  assert.equal(H.resumeInterrupted({ id: 'a', upload_status: 'uploading' }).upload_status, 'pending');
  const done = { id: 'b', upload_status: 'uploaded' };
  assert.equal(H.resumeInterrupted(done), done);
});

test('the status chip: Uploaded, Waiting for Wi-Fi, Uploading, Failed', () => {
  const mobile = { connected: true, wifi: false };
  assert.equal(H.photoStatusKey({ upload_status: 'uploaded' }), 'uploaded');
  assert.equal(H.photoStatusKey({ upload_status: 'uploading' }), 'uploading');
  assert.equal(H.photoStatusKey({ upload_status: 'failed' }), 'failed');
  assert.equal(H.photoStatusKey({ upload_status: 'pending' }, { wifiOnly: true, network: mobile }), 'waitingWifi');
  assert.equal(H.photoStatusKey({ upload_status: 'pending' }, { wifiOnly: false, network: mobile }), 'waiting');
});

// --- the buyer's view -----------------------------------------------------------------------------

test('a buyer sees the product, where it was grown, the farmer as first name and initial, photos and activity', () => {
  const view = H.buildBuyerView({
    harvest: HARVEST, farm: FARM, farmer: FARMER, crop: { name: 'Rice' }, variety: { name: 'Suakoko 8' },
    photos: [
      photo(2, '2026-10-23T00:00:00Z', { tag: 'grain' }),
      photo(1, '2026-10-22T00:00:00Z'),
      photo(4, '2026-10-25T00:00:00Z', { deleted_at: 'x' }), // removed
    ],
    activities: [act('2026-09-10', 'Weeding', { weather_sky: 'rain', rain_mm: 12 }), act('2026-05-02', 'Seed sowing')],
  });
  assert.equal(view.batchId, 'LR-BON-GEN-RICE-2026-123456');
  assert.deepEqual([view.crop, view.variety, view.quantity, view.unit, view.harvestDate], ['Rice', 'Suakoko 8', 250, 'kg', '2026-10-22']);
  assert.deepEqual([view.district, view.county, view.farmer], ['Suakoko', 'Bong', 'Emmanuel G.']);
  assert.equal(view.approved, true);
  assert.deepEqual(view.photos.map((p) => [p.id, p.tag]), [['p1', 'bags'], ['p2', 'grain']], 'oldest first; removed hidden');
  assert.deepEqual(view.activities, [{ type: 'Seed sowing', date: '2026-05-02' }, { type: 'Weeding', date: '2026-09-10' }], 'type and date only, no weather');
});

test('"Approved" is shown only when an inspector approved the batch', () => {
  for (const status of ['draft', 'submitted', 'pending_inspection', 'under_inspection', 'inspected', 'rejected']) {
    assert.equal(H.buildBuyerView({ harvest: { ...HARVEST, status } }).approved, false, status);
  }
  assert.equal(H.buildBuyerView({ harvest: { ...HARVEST, status: 'approved' } }).approved, true);
});

test('a buyer never sees private details, whatever is on the records', () => {
  const view = H.buildBuyerView({
    harvest: HARVEST, farm: FARM, farmer: FARMER, crop: { name: 'Rice' },
    photos: [photo(1, '2026-10-22T00:00:00Z', { storage_path: 'PRIVATE-PATH' })],
    activities: [act('2026-09-10', 'Weeding', { weather_sky: 'rain', rain_mm: 12, day_feel: 'sweltering' })],
  });
  const json = JSON.stringify(view);
  for (const secret of ['PRIVATE', 'farmer-private-id', '+231', '31337', '99999', '77777', 'Kollie Rice Farm', '7.123456', '-9.654321', 'Rain', 'sweltering']) {
    assert.ok(!json.includes(secret), `leaked: ${secret}`);
  }
  assert.ok(!json.includes('Kollie'), 'only the first name and the initial of the last name');
  assert.deepEqual(Object.keys(view).sort(), ['activities', 'approved', 'batchId', 'county', 'crop', 'district', 'farmer', 'harvestDate', 'photos', 'quantity', 'unit', 'variety']);
});

test('farmer label: first name and the initial of the last name', () => {
  assert.equal(H.farmerLabel('Emmanuel Kollie Gaye'), 'Emmanuel G.');
  assert.equal(H.farmerLabel('korto flomo'), 'korto F.');
  assert.equal(H.farmerLabel('Madonna'), 'Madonna');
  assert.equal(H.farmerLabel('  '), null);
  assert.equal(H.farmerLabel(undefined), null);
});

test('the farm activities for a buyer are those of the year before the harvest, in its season', () => {
  const list = H.activitiesForBuyer(
    [act('2025-10-20', 'Too early'), act('2025-10-23', 'Land clearing'), act('2026-10-22', 'Harvesting'), act('2026-10-23', 'After harvest'), act('2026-06-01', 'Other season', { season_id: 's2' }), act('2026-06-02', 'Removed', { deleted_at: 'x' }), act('2026-07-01', 'Other farm', { farm_id: 'farm2' })],
    HARVEST
  );
  assert.deepEqual(list.map((a) => a.activity_type), ['Land clearing', 'Harvesting']);
});
