const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../src/shared/harvestPhotos');

const HARVEST = {
  id: 'h1', farm_id: 'farm1', season_id: 's1', batch_reference: 'LR-BON-GEN-RICE-2026-123456', crop_variety_id: 'Suakoko 8',
  quantity: 250, unit: 'kg', harvest_date: '2026-10-22', status: 'approved', qr_token: 'secret-token', farmer_id: 'farmer-private-id',
  total_value: 99999, unit_price: 77777, storage_location: 'PRIVATE-STORE', observations: 'PRIVATE-OBS', photo_url: null,
};
const FARM = { id: 'farm1', name: 'Kollie Rice Farm', county: 'Bong', district: 'Suakoko', community: 'PRIVATE-COMMUNITY', latitude: 7.123456, longitude: -9.654321, farmer_id: 'farmer-private-id' };
const act = (date, type, extra = {}) => ({ id: `a-${date}-${type}`, farm_id: 'farm1', activity_type: type, activity_date: date, description: 'PRIVATE-NOTE 0777123456', cost: 31337, labor_count: 9, recorded_by: 'user-private', farmer_id: 'farmer-private-id', ...extra });

test('a new photo is saved on the phone first, with its place in the bucket', () => {
  const p = H.buildPhoto({ harvestId: 'h1', farmId: 'farm1', localUri: 'file:///a.jpg', now: new Date('2026-11-21T10:00:00Z'), id: 'p1' });
  assert.deepEqual([p.id, p.harvest_id, p.farm_id, p.storage_path, p.uploaded, p.public_url, p.deleted_at], ['p1', 'h1', 'farm1', 'h1/p1.jpg', false, null, null]);
  assert.equal(p.local_uri, 'file:///a.jpg');
  assert.match(H.buildPhoto({ harvestId: 'h1', localUri: 'x' }).id, /^[0-9a-f-]{36}$/);
  assert.throws(() => H.buildPhoto({ localUri: 'x' }), /Harvest/);
  assert.throws(() => H.buildPhoto({ harvestId: 'h1' }), /file/);
});

test('only the picture record goes to the server, not the phone-only fields', () => {
  const row = H.toServerRow(H.buildPhoto({ harvestId: 'h1', localUri: 'file:///a.jpg', id: 'p1' }));
  assert.ok(!('local_uri' in row) && !('uploaded' in row));
  assert.deepEqual(Object.keys(row).sort(), ['created_at', 'deleted_at', 'farm_id', 'harvest_id', 'id', 'public_url', 'storage_path', 'updated_at']);
});

test('a harvest holds at most 6 photos', () => {
  const photos = (n) => Array.from({ length: n }, (_, i) => ({ id: String(i), deleted_at: null }));
  assert.equal(H.MAX_PHOTOS_PER_HARVEST, 6);
  assert.equal(H.canAddPhoto(photos(5)), true);
  assert.equal(H.canAddPhoto(photos(6)), false);
  assert.equal(H.canAddPhoto([...photos(6).slice(1), { id: 'gone', deleted_at: 'x' }]), true, 'removed photos do not count');
});

test('the public address of a picture', () => {
  assert.equal(H.publicPhotoUrl('https://abc.supabase.co/', 'h1/p1.jpg'), 'https://abc.supabase.co/storage/v1/object/public/harvest-photos/h1/p1.jpg');
});

test('a buyer sees the product, farm name and county, photos and farm activities', () => {
  const view = H.buildBuyerView({
    harvest: HARVEST, farm: FARM, crop: { name: 'Rice' },
    photos: [
      { id: 'p2', public_url: 'https://x/2.jpg', created_at: '2026-10-23T00:00:00Z' },
      { id: 'p1', public_url: 'https://x/1.jpg', created_at: '2026-10-22T00:00:00Z' },
      { id: 'p3', public_url: null, created_at: '2026-10-24T00:00:00Z' }, // not uploaded yet: nothing to show
      { id: 'p4', public_url: 'https://x/4.jpg', created_at: '2026-10-25T00:00:00Z', deleted_at: 'x' }, // removed
    ],
    activities: [act('2026-09-10', 'Weeding', { weather_sky: 'rain', rain_mm: 12 }), act('2026-05-02', 'Seed sowing')],
  });
  assert.deepEqual(view.product, { crop: 'Rice', variety: 'Suakoko 8', quantity: 250, unit: 'kg', harvestDate: '2026-10-22', status: 'approved' });
  assert.deepEqual(view.farm, { name: 'Kollie Rice Farm', county: 'Bong' });
  assert.deepEqual(view.photos.map((p) => p.url), ['https://x/1.jpg', 'https://x/2.jpg'], 'oldest first; unfinished and removed photos hidden');
  assert.deepEqual(view.activities.map((a) => [a.date, a.type, a.weather]), [['2026-05-02', 'Seed sowing', null], ['2026-09-10', 'Weeding', 'Rain · 12 mm']]);
  assert.equal(view.batchReference, 'LR-BON-GEN-RICE-2026-123456');
});

test('a buyer never sees private details, whatever is on the records', () => {
  const view = H.buildBuyerView({
    harvest: HARVEST, farm: FARM, crop: { name: 'Rice' },
    photos: [{ id: 'p1', public_url: 'https://x/1.jpg', created_at: 'a', local_uri: 'file:///PRIVATE-FILE.jpg' }],
    activities: [act('2026-09-10', 'Weeding', { weather_sky: 'rain' })],
  });
  const text = JSON.stringify(view);
  for (const secret of ['PRIVATE', 'secret-token', '31337', '99999', '77777', '0777123456', 'farmer-private-id', 'user-private', '7.123456', '-9.654321', 'labor']) {
    assert.ok(!text.includes(secret), `leaked: ${secret}`);
  }
  assert.ok(!text.includes('Suakoko') || text.includes('Suakoko 8'), 'only the variety, not the district');
  assert.deepEqual(Object.keys(view.farm), ['name', 'county'], 'no district, community or coordinates');
  assert.deepEqual(Object.keys(view.activities[0]), ['id', 'date', 'type', 'weather'], 'no cost, workers or notes');
});

test('activities: this farm only, up to the harvest date, within the year before, and this season only', () => {
  const list = H.activitiesForBuyer(
    [
      act('2026-10-22', 'Harvesting'), // harvest day: included
      act('2026-10-23', 'Weeding'), // after the harvest
      act('2025-10-23', 'Weeding'), // 364 days before: inside the year
      act('2025-10-21', 'Weeding'), // more than a year before
      act('2026-06-01', 'Weeding', { farm_id: 'other-farm' }),
      act('2026-06-02', 'Weeding', { season_id: 'another-season' }),
      act('2026-06-03', 'Weeding', { season_id: 's1' }),
      act('2026-06-04', 'Weeding', { deleted_at: '2026-07-01' }),
      act('2026-06-05', 'Weeding', { activity_date: '' }),
    ],
    HARVEST
  );
  assert.deepEqual(list.map((a) => a.activity_date), ['2025-10-23', '2026-06-03', '2026-10-22']);
  assert.deepEqual(H.activitiesForBuyer([act('2026-06-03', 'Weeding')], { ...HARVEST, harvest_date: null }), []);
  assert.deepEqual(H.activitiesForBuyer([act('2026-06-02', 'Weeding', { season_id: 'x' })], { ...HARVEST, season_id: null }).length, 1, 'no season on the harvest: all of the farm year');
  assert.equal(H.buildBuyerView({ harvest: null }), null);
});

test('a harvest variety that is only an id is not shown as a name', () => {
  const v = H.buildBuyerView({ harvest: { ...HARVEST, crop_variety_id: '3f2b8c1e-9d4a-4b6f-8a7e-1c2d3e4f5a6b' }, farm: FARM });
  assert.equal(v.product.variety, null);
});
