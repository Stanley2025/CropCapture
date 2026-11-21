const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/shared/farmPlan');

const FARM = '3f2b8c1e-9d4a-4b6f-8a7e-1c2d3e4f5a6b';
const NOW = new Date('2026-11-21T10:00:00Z');

test('the plan is for the current year plus one', () => {
  assert.equal(P.planYearFor(NOW), 2027);
  assert.equal(P.planYearFor(new Date('2026-01-01T00:00:00Z')), 2027);
});

test('one plan per farm per year: the id is made from the farm and the year', () => {
  const id = P.planIdFor(FARM, 2027);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(id, P.planIdFor(FARM, 2027), 'two phones get the same id');
  assert.notEqual(id, P.planIdFor(FARM, 2028), 'another year is another plan');
  assert.notEqual(id, P.planIdFor('4f2b8c1e-9d4a-4b6f-8a7e-1c2d3e4f5a6b', 2027), 'another farm is another plan');
  assert.notEqual(id, FARM);
  // no clashes across many farms and years
  const seen = new Set();
  let n = 0;
  for (let i = 0; i < 3000; i++) {
    const farm = require('node:crypto').randomUUID();
    for (const y of [2025, 2026, 2027]) { seen.add(P.planIdFor(farm, y)); n++; }
  }
  assert.equal(seen.size, n);
  assert.match(P.planIdFor('not-a-uuid', 2027), /^[0-9a-f-]{36}$/, 'falls back to a random uuid');
});

test('saving a plan keeps only what the farmer entered', () => {
  const plan = P.buildPlan({ farmId: FARM, year: 2027, crop: '  Upland   rice ', plantingDate: '2027-05-10', changeNote: 'Weed earlier,  use more seed.', now: NOW });
  assert.deepEqual(
    { crop: plan.crop, planting_date: plan.planting_date, change_note: plan.change_note, plan_year: plan.plan_year, farm_id: plan.farm_id, deleted_at: plan.deleted_at },
    { crop: 'Upland rice', planting_date: '2027-05-10', change_note: 'Weed earlier, use more seed.', plan_year: 2027, farm_id: FARM, deleted_at: null }
  );
  assert.equal(plan.created_at, NOW.toISOString());
  // everything is optional: nothing is filled in for the farmer
  const blank = P.buildPlan({ farmId: FARM, year: 2027, now: NOW });
  assert.deepEqual([blank.crop, blank.planting_date, blank.change_note], [null, null, null]);
  assert.equal(P.buildPlan({ farmId: FARM, year: 2027, crop: '   ', changeNote: '' }).crop, null);
});

test('saving again updates the same plan and keeps its first creation time', () => {
  const first = P.buildPlan({ farmId: FARM, year: 2027, crop: 'Rice', now: NOW });
  const later = new Date('2026-12-02T08:00:00Z');
  const second = P.buildPlan({ farmId: FARM, year: 2027, crop: 'Cassava', existing: first, now: later });
  assert.equal(second.id, first.id, 'same plan, not a second one');
  assert.equal(second.created_at, first.created_at);
  assert.equal(second.updated_at, later.toISOString());
  assert.equal(second.crop, 'Cassava');
  // a plan that was removed comes back clean when saved again
  assert.equal(P.buildPlan({ farmId: FARM, year: 2027, existing: { ...first, deleted_at: '2026-12-01T00:00:00Z' } }).deleted_at, null);
});

test('wrong input is refused', () => {
  assert.throws(() => P.buildPlan({ year: 2027 }), /Farm/);
  assert.throws(() => P.buildPlan({ farmId: FARM, year: 1999 }), /year/);
  assert.throws(() => P.buildPlan({ farmId: FARM, year: 2027.5 }), /year/);
  assert.throws(() => P.buildPlan({ farmId: FARM, year: 2027, plantingDate: '10/05/2027' }), /date/);
  assert.equal(P.buildPlan({ farmId: FARM, year: 2027, crop: 'x'.repeat(500) }).crop.length, P.MAX_CROP_LENGTH);
  assert.equal(P.buildPlan({ farmId: FARM, year: 2027, changeNote: 'y'.repeat(2000) }).change_note.length, P.MAX_NOTE_LENGTH);
});

test('the comparison shows the previous two years, with "Not recorded" (null) where nothing was recorded', () => {
  const act = (date, type, extra = {}) => ({ id: `${type}${date}`, farm_id: FARM, activity_type: type, activity_date: date, ...extra });
  const activities = [
    act('2025-04-10', 'Seed sowing'), act('2025-05-02', 'First weeding', { weather_sky: 'rain' }), act('2025-06-01', 'Second weeding', { weather_sky: 'sunny' }),
    act('2026-04-20', 'Transplanting'), // 2026: planting only, nothing else
  ];
  const harvests = [{ id: 'h1', farm_id: FARM, harvest_date: '2025-09-15', quantity: 500, unit: 'kg' }];
  const table = P.comparePreviousYears({ activities, harvests, planYear: 2027 });
  assert.deepEqual(table.years, [2025, 2026]);
  const by = Object.fromEntries(table.rows.map((r) => [r.key, r.values]));
  assert.deepEqual(by.harvest, [500, null], '2026 has no harvest recorded');
  assert.deepEqual(by.planting, ['2025-04-10', '2026-04-20']);
  assert.deepEqual(by.rainyDays, [1, null], '2026 has no weather recorded');
  assert.deepEqual(by.weeding, [2, null]);
  assert.deepEqual(by.fertilizer, [null, null], 'no fertilizer in either year is not 0');
  assert.deepEqual(table.rows.map((r) => r.key), ['harvest', 'planting', 'rainyDays', 'weeding', 'fertilizer']);
});
