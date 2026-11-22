const test = require('node:test');
const assert = require('node:assert/strict');
const { makeDb, insights, detail, ID } = require('./helpers/countyDb');
const { loadAdmin } = require('./helpers/loadAdminTs');

const L = loadAdmin('lib/counties/insights.ts');
const S = loadAdmin('lib/counties/service.ts');

const F = (over = {}) => ({ ...L.parseFilters({ year: '2026' }, new Date('2026-11-22T10:00:00Z')), ...over });
const byTitle = (h, title) => h.find((x) => x.title === title);

// ---- filters in the address ----------------------------------------------------------------------------------
test('filters are read from the address, default to this year and all crops, and give the same view after a reload', () => {
  const now = new Date('2026-11-22T10:00:00Z');
  const d = L.parseFilters({}, now);
  assert.deepEqual(d, { year: 2026, crop: null, status: 'all', county: null, sort: 'harvest_kg', dir: 'desc' });
  const f = L.parseFilters(new URLSearchParams(`year=all&crop=${ID.rice}&status=approved&county=${ID.nimba}&sort=farmers&dir=asc`), now);
  assert.deepEqual(f, { year: null, crop: ID.rice, status: 'approved', county: ID.nimba, sort: 'farmers', dir: 'asc' });
  // the address made from the filters reads back as the same filters: a shared link shows the same numbers
  assert.deepEqual(L.parseFilters(new URLSearchParams(L.filtersToQuery(f)), now), f);
  assert.deepEqual(L.parseFilters(new URLSearchParams(L.filtersToQuery(d)), now), d);
  // nonsense in the address falls back to the defaults
  const bad = L.parseFilters({ year: 'abc', crop: "x'; drop table", status: 'zzz', county: '../..', sort: 'password', dir: 'sideways' }, now);
  assert.deepEqual(bad, d);
  assert.equal(L.parseFilters({ year: '1850' }, now).year, 2026, 'a year out of range is ignored');
  assert.equal(L.parseFilters({ county: 'unassigned' }, now).county, 'unassigned');
});

// ---- highlights, from the real function output of the test database ------------------------------------------
test('highlight cards: the right county, ties show both, unassigned never wins', async () => {
  const db = await makeDb();
  const data = await insights(db, ID.admin, 2026);
  const h = L.buildHighlights(data);

  const farmers = byTitle(h, 'County with most farmers');
  assert.deepEqual([farmers.names, farmers.value, farmers.tied], [['Bong', 'Nimba'], '4 farmers', true], 'Bong and Nimba tie at 4');

  const harvest = byTitle(h, 'County with most harvest');
  assert.deepEqual([harvest.names, harvest.value, harvest.tied], [['Lofa', 'Nimba'], '800 kg', true], 'Lofa and Nimba tie at 800 kg');

  const farms = byTitle(h, 'County with most farms');
  assert.deepEqual([farms.names, farms.value, farms.tied], [['Nimba'], '6 farms', false]);

  const gender = byTitle(h, 'Gender with most farms');
  assert.deepEqual(gender.names, ['Male']);
  assert.equal(gender.value, '9 farms (64.3% of all farms)', '9 of 14');
  assert.equal(gender.note, 'Owner gender is not recorded for 1 of these farms.');

  const women = byTitle(h, 'County where women own the most farms');
  assert.deepEqual([women.names, women.value], [['Bong'], '2 farms']);
  const men = byTitle(h, 'County where men own the most farms');
  assert.deepEqual([men.names, men.value], [['Nimba'], '5 farms']);
});

test('highlights with no data say "No records yet"; equal genders say "Equal"', async () => {
  const db = await makeDb();
  await db.exec('DELETE FROM harvest_batches; DELETE FROM farms; DELETE FROM farmers');
  const h = L.buildHighlights(await insights(db, ID.admin, 2026));
  for (const card of h) {
    assert.equal(card.empty, true, card.title);
    assert.deepEqual(card.names, []);
  }

  const eq = { counties: [], national: { farms: 10, farms_male: 4, farms_female: 4, farms_unrecorded: 2 } };
  const g = byTitle(L.buildHighlights(eq), 'Gender with most farms');
  assert.deepEqual([g.names, g.value], [['Equal'], '4 farms each (40.0%)']);
  assert.ok(g.note.includes('2'), 'the 2 farms with no owner gender are mentioned');
});

// ---- the table, sorting and the gender bars -------------------------------------------------------------------
test('the table is sorted by harvest by default, any column can be sorted, and the unassigned row stays last', async () => {
  const db = await makeDb();
  const data = await insights(db, ID.admin, 2026);
  const names = (rows) => rows.map((r) => r.county);
  assert.deepEqual(names(L.sortRows(data.counties, 'harvest_kg', 'desc')), ['Lofa', 'Nimba', 'Bong', 'Sinoe', 'Unassigned county'], 'ties in name order');
  assert.deepEqual(names(L.sortRows(data.counties, 'harvest_kg', 'asc')), ['Sinoe', 'Bong', 'Lofa', 'Nimba', 'Unassigned county']);
  assert.deepEqual(names(L.sortRows(data.counties, 'farmers', 'desc')), ['Bong', 'Nimba', 'Lofa', 'Sinoe', 'Unassigned county']);
  assert.deepEqual(names(L.sortRows(data.counties, 'county', 'asc')), ['Bong', 'Lofa', 'Nimba', 'Sinoe', 'Unassigned county']);
  assert.deepEqual(names(L.sortRows(data.counties, 'farms_female', 'desc')), ['Bong', 'Lofa', 'Nimba', 'Sinoe', 'Unassigned county']);
  assert.equal(L.COLUMNS.length, 13);
});

test('gender bars: every part has a written label and the parts add up; plus a plain-text description', async () => {
  const db = await makeDb();
  const bong = (await insights(db, ID.admin, 2026)).counties.find((c) => c.county === 'Bong');
  const parts = L.genderSegments(bong.farmers_male, bong.farmers_female, bong.farmers_unrecorded);
  assert.deepEqual(parts.map((p) => p.text), ['Male 2 (50.0%)', 'Female 1 (25.0%)', 'Gender not recorded 1 (25.0%)']);
  assert.equal(Math.round(parts.reduce((s, p) => s + p.pct, 0)), 100);
  assert.equal(L.genderDescription(bong), 'Bong: 4 farmers. Male 2, female 1, not recorded 1.');
  assert.deepEqual(L.genderSegments(0, 0, 0).map((p) => p.pct), [0, 0, 0], 'an empty county has an empty bar, not NaN');
});

test('a harvest figure that cannot be known says "Not recorded", but a real 0 stays 0', () => {
  const none = { harvests: 3, harvests_no_weight: 3, harvest_kg: 0 };
  assert.equal(L.harvestCell(none, 0), 'Not recorded');
  assert.equal(L.harvestCell({ harvests: 3, harvests_no_weight: 1, harvest_kg: 40 }, 40), 40);
  assert.equal(L.harvestCell({ harvests: 0, harvests_no_weight: 0, harvest_kg: 0 }, 0), 0, 'no harvest at all is 0 kg');
});

// ---- CSV -----------------------------------------------------------------------------------------------------
test('the CSV has the table\'s columns, the table\'s numbers and a closing line with the filters and the time', async () => {
  const db = await makeDb();
  const data = await insights(db, ID.admin, 2026);
  const csv = L.toCsv(data, F({ sort: 'harvest_kg', dir: 'desc' }), null, new Date('2026-11-22T10:30:00Z'));
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], 'County,Farmers,Farms,Harvest (kg),Male farmers,Female farmers,Gender not recorded,Farms owned by men,Farms owned by women,"Farms, owner gender not recorded","Harvest (kg), men","Harvest (kg), women","Harvest (kg), gender not recorded"');
  assert.equal(lines[1], 'Lofa,2,2,800,1,1,0,1,1,0,300,500,0');
  assert.equal(lines[2], 'Nimba,4,6,800,3,1,0,5,1,0,500,300,0');
  assert.equal(lines[3], 'Bong,4,5,700,2,1,1,2,2,1,400,200,100');
  assert.equal(lines[4], 'Sinoe,0,0,0,0,0,0,0,0,0,0,0,0');
  assert.equal(lines[5], 'Unassigned county,0,1,25,0,0,0,1,0,0,25,0,0');
  assert.equal(lines[6], 'Filters: Year=2026; Crop=All crops; Status=All records,Created: 2026-11-22T10:30:00.000Z');
  assert.equal(lines.length, 7);

  const approved = L.toCsv(await insights(db, ID.admin, null, ID.cassava, true), L.parseFilters({ year: 'all', status: 'approved', crop: ID.cassava }), 'Cassava', new Date('2026-11-22T10:30:00Z'));
  assert.ok(approved.trim().split('\r\n').pop().startsWith('Filters: Year=All years; Crop=Cassava; Status=Approved records only'));
});

test('the CSV quotes anything with a comma or a quote', () => {
  const data = { counties: [{ county: 'A "big", county', is_unassigned: false, farmers: 1, farmers_male: 1, farmers_female: 0, farmers_unrecorded: 0, farms: 1, farms_male: 1, farms_female: 0, farms_unrecorded: 0, harvests: 1, harvests_no_weight: 1, harvest_kg: 0, harvest_kg_male: 0, harvest_kg_female: 0, harvest_kg_unrecorded: 0 }] };
  const lines = L.toCsv(data, F(), null).split('\r\n');
  assert.ok(lines[1].startsWith('"A ""big"", county",1,1,Not recorded,'), lines[1]);
});

// ---- access, caching and errors through the real functions -----------------------------------------------------
function clientFor(db, uid, counters = { rpc: 0 }) {
  const sqlFor = {
    is_insights_admin: ['SELECT public.is_insights_admin() AS r', () => []],
    admin_county_insights: ['SELECT public.admin_county_insights($1::int, $2::uuid, $3::boolean) AS r', (a) => [a.p_year, a.p_crop, a.p_approved_only]],
    admin_county_detail: ['SELECT public.admin_county_detail($1::uuid, $2::int, $3::uuid, $4::boolean) AS r', (a) => [a.p_county, a.p_year, a.p_crop, a.p_approved_only]],
  };
  return {
    counters,
    auth: { getUser: async () => ({ data: { user: uid ? { id: uid } : null } }) },
    rpc: async (name, args = {}) => {
      counters.rpc++;
      const [sql, params] = sqlFor[name];
      try {
        await db.query(`SELECT set_config('test.uid', $1, false)`, [uid || '']);
        const r = await db.query(sql, params(args));
        return { data: r.rows[0].r, error: null };
      } catch (e) {
        return { data: null, error: { message: e.message, code: /not_allowed/.test(e.message) ? '42501' : undefined } };
      }
    },
  };
}

test('only a signed-in administrator is served; a signed-out user and a non-admin are refused', async () => {
  const db = await makeDb();
  const run = async (uid) => S.createCountyService(async () => clientFor(db, uid)).insights(F());
  assert.equal((await run(null)).status, 'signed_out');
  assert.equal((await run(ID.inspector)).status, 'forbidden');
  assert.equal((await run(ID.farmerUser)).status, 'forbidden');
  const ok = await run(ID.admin);
  assert.equal(ok.status, 'ok');
  assert.equal(ok.data.national.harvest_kg, 2325);
  // the detail view is protected the same way
  const svc = S.createCountyService(async () => clientFor(db, ID.inspector));
  assert.equal((await svc.detail(F(), ID.nimba)).status, 'forbidden');
});

test('the answer is kept for 5 minutes per filter set, a changed filter loads fresh, and a signed-out user never gets a kept answer', async () => {
  const db = await makeDb();
  let t = 1000;
  const counters = { rpc: 0 };
  let uid = ID.admin;
  const svc = S.createCountyService(async () => clientFor(db, uid, counters), { now: () => t });
  await svc.insights(F());
  const afterFirst = counters.rpc; // the check + the numbers
  await svc.insights(F());
  assert.equal(counters.rpc, afterFirst + 1, 'second call: only the admin check, the numbers are kept');
  await svc.insights(F({ year: 2025 }));
  assert.equal(counters.rpc, afterFirst + 3, 'a different filter asks the database again');
  t += 5 * 60 * 1000 + 1;
  await svc.insights(F());
  assert.equal(counters.rpc, afterFirst + 5, 'after 5 minutes it asks again');
  uid = null;
  assert.equal((await svc.insights(F())).status, 'signed_out', 'kept numbers are not given to a signed-out user');
});

test('a database error becomes an error state, never a made-up number', async () => {
  const svc = S.createCountyService(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: ID.admin } } }) },
    rpc: async (name) => (name === 'is_insights_admin' ? { data: true, error: null } : { data: null, error: { message: 'connection refused' } }),
  }));
  const r = await svc.insights(F());
  assert.deepEqual(r, { status: 'error', message: 'connection refused' });
  const thrown = S.createCountyService(async () => { throw new Error('no client'); });
  assert.equal((await thrown.insights(F())).status, 'error');
});

test('the detail view through the service shows the district split rules and top crops', async () => {
  const db = await makeDb();
  const svc = S.createCountyService(async () => clientFor(db, ID.admin));
  const r = await svc.detail(F(), ID.nimba);
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.data.top_crops[0], { crop: 'Rice', harvest_kg: 750 });
  assert.ok(r.data.districts.every((d) => d.small_group && d.farmers_male === null));
});
