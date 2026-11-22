const test = require('node:test');
const assert = require('node:assert/strict');
const { makeDb, asUser, insights, detail, ID } = require('./helpers/countyDb');

const row = (data, name) => data.counties.find((c) => c.county === name);

test('every county appears, including counties with nothing recorded, and the unassigned group', async () => {
  const db = await makeDb();
  const data = await insights(db, ID.admin, 2026);
  assert.deepEqual(data.counties.map((c) => c.county), ['Bong', 'Lofa', 'Nimba', 'Sinoe', 'Unassigned county']);
  const sinoe = row(data, 'Sinoe');
  assert.deepEqual([sinoe.farmers, sinoe.farms, sinoe.harvest_kg, sinoe.farmers_male, sinoe.farms_female], [0, 0, 0, 0, 0], 'zero, not a missing row');
});

test('farmers, farms and harvest per county match the hand-worked numbers', async () => {
  const db = await makeDb();
  const d = await insights(db, ID.admin, 2026);
  const pick = (n, ...keys) => keys.map((k) => row(d, n)[k]);
  // farmers, male, female, not recorded
  assert.deepEqual(pick('Nimba', 'farmers', 'farmers_male', 'farmers_female', 'farmers_unrecorded'), [4, 3, 1, 0]);
  assert.deepEqual(pick('Bong', 'farmers', 'farmers_male', 'farmers_female', 'farmers_unrecorded'), [4, 2, 1, 1]);
  assert.deepEqual(pick('Lofa', 'farmers', 'farmers_male', 'farmers_female', 'farmers_unrecorded'), [2, 1, 1, 0]);
  // farms by owner gender
  assert.deepEqual(pick('Nimba', 'farms', 'farms_male', 'farms_female', 'farms_unrecorded'), [6, 5, 1, 0]);
  assert.deepEqual(pick('Bong', 'farms', 'farms_male', 'farms_female', 'farms_unrecorded'), [5, 2, 2, 1]);
  assert.deepEqual(pick('Lofa', 'farms', 'farms_male', 'farms_female', 'farms_unrecorded'), [2, 1, 1, 0]);
  // harvest kg: grams and pounds are converted, bags (no weight) are not added
  assert.deepEqual(pick('Nimba', 'harvest_kg', 'harvest_kg_male', 'harvest_kg_female', 'harvest_kg_unrecorded'), [800, 500, 300, 0]);
  assert.deepEqual(pick('Bong', 'harvest_kg', 'harvest_kg_male', 'harvest_kg_female', 'harvest_kg_unrecorded'), [700, 400, 200, 100]);
  assert.deepEqual(pick('Lofa', 'harvest_kg', 'harvest_kg_male', 'harvest_kg_female', 'harvest_kg_unrecorded'), [800, 300, 500, 0]);
});

test('a farmer with 3 farms is 1 farmer and 3 farms, in every county total', async () => {
  const db = await makeDb();
  const d = await insights(db, ID.admin, 2026);
  assert.equal(row(d, 'Nimba').farmers, 4, 'm1 has 3 farms but is counted once');
  assert.equal(row(d, 'Nimba').farms, 6);
  const direct = (await db.query(`SELECT count(DISTINCT farmer_id)::int AS n, count(*)::int AS f FROM farms WHERE county_id = $1 AND source <> 'seed'`, [ID.nimba])).rows[0];
  assert.equal(direct.f, 5, 'the farm with a county written only as text is the 6th, found by name');
});

test('records with a misspelled or missing county are shown as Unassigned county, never dropped', async () => {
  const db = await makeDb();
  const d = await insights(db, ID.admin, 2026);
  const un = row(d, 'Unassigned county');
  assert.deepEqual([un.farms, un.farms_male, un.harvest_kg], [1, 1, 25]);
  assert.equal(un.is_unassigned, true);
  assert.equal(d.national.farms, 14, 'all 14 real farms are somewhere');
  assert.equal(d.national.harvest_kg, 2325);
});

test('county names are matched after trimming, case and a trailing "County"; a misspelled farmer falls back to their farm', async () => {
  const db = await makeDb();
  const d = await insights(db, ID.admin, 2026);
  // f2 is written "bong " and f3 "Lofa County": both counted. u1 is "Bongo" (not a county): counted through the farm in Bong.
  assert.equal(row(d, 'Bong').farmers, 4);
  assert.equal(row(d, 'Lofa').farmers, 2);
  assert.equal(row(d, 'Unassigned county').farmers, 0);
  // a farmer with a bad county and no farm at all is Unassigned
  await db.query(`INSERT INTO farmers (id, full_name, gender, county) VALUES ('00000000-0000-4000-8000-000000000999', 'Lost', 'Female', 'Nowhere')`);
  const d2 = await insights(db, ID.admin, 2026);
  assert.equal(row(d2, 'Unassigned county').farmers, 1);
  assert.equal(d2.national.farmers, 11);
});

test('sample records, deleted harvests and replaced harvests are left out, and the page says how many', async () => {
  const db = await makeDb();
  const d = await insights(db, ID.admin, 2026);
  assert.equal(d.national.farmers, 10, 'the sample farmer is not counted');
  assert.equal(d.national.farms, 14, 'the sample farm is not counted');
  assert.equal(d.national.harvest_kg, 2325, 'not the deleted 1000, replaced 777 or sample 5000');
  assert.deepEqual(d.excluded, { sample_farmers: 1, sample_farms: 1, sample_harvests: 1, deleted_harvests: 1, replaced_harvests: 1 });
});

test('harvests whose weight cannot be known are counted, reported, and never added as 0 kg or a guess', async () => {
  const db = await makeDb();
  const d = await insights(db, ID.admin, 2026);
  assert.equal(row(d, 'Bong').harvests_no_weight, 1, 'the 10 bags');
  assert.equal(d.national.harvests_no_weight, 1);
  assert.equal(row(d, 'Bong').harvests, 5, 'it is still one of Bong\'s harvests');
  // the same harvest with a weight per bag recorded IS converted, using that weight
  await db.query(`UPDATE harvest_batches SET kg_per_unit = 50 WHERE unit = 'bags'`);
  const d2 = await insights(db, ID.admin, 2026);
  assert.equal(row(d2, 'Bong').harvest_kg, 1200);
  assert.equal(d2.national.harvests_no_weight, 0);
});

test('units are converted in one place: kg, g, lb, tonne, and a weight the app already worked out wins', async () => {
  const db = await makeDb();
  const kg = async (q, unit, qkg = null, kpu = null) => Number((await db.query('SELECT public.harvest_weight_kg($1::numeric, $2::text, $3::numeric, $4::numeric) AS k', [q, unit, qkg, kpu])).rows[0].k);
  assert.equal(await kg(5, 'kg'), 5);
  assert.equal(await kg(2500, 'g'), 2.5);
  assert.ok(Math.abs((await kg(100, 'lbs')) - 45.359237) < 1e-6);
  assert.equal(await kg(2, 'Tonnes'), 2000);
  assert.equal(await kg(3, 'bags', null, 50), 150);
  assert.equal((await db.query("SELECT public.harvest_weight_kg(3, 'bags', NULL, NULL) IS NULL AS n")).rows[0].n, true, 'a bag with no weight is not turned into a number');
  assert.equal(await kg(7, 'heads', 99), 99, 'quantity_kg wins');
});

test('filters: year, crop and approved only change the harvest numbers exactly', async () => {
  const db = await makeDb();
  const y2025 = await insights(db, ID.admin, 2025);
  assert.equal(row(y2025, 'Nimba').harvest_kg, 40);
  assert.equal(y2025.national.harvest_kg, 40);
  assert.equal(row(y2025, 'Nimba').farmers, 4, 'registered farmers do not depend on the harvest year');

  const all = await insights(db, ID.admin, null);
  assert.equal(all.national.harvest_kg, 2325 + 40);

  const cassava = await insights(db, ID.admin, 2026, ID.cassava);
  assert.equal(row(cassava, 'Nimba').harvest_kg, 50);
  assert.equal(cassava.national.harvest_kg, 50);

  const approved = await insights(db, ID.admin, 2026, null, true);
  assert.equal(row(approved, 'Nimba').harvest_kg, 200);
  assert.equal(row(approved, 'Bong').harvest_kg, 400);
  assert.equal(approved.national.harvest_kg, 600);
});

test('the numbers equal a plain SQL count of the same tables', async () => {
  const db = await makeDb();
  const d = await insights(db, ID.admin, 2026);
  const one = async (sql) => Number((await db.query(sql)).rows[0].n);
  assert.equal(d.national.farmers, await one(`SELECT count(*) AS n FROM farmers WHERE source <> 'seed'`));
  assert.equal(d.national.farms, await one(`SELECT count(*) AS n FROM farms WHERE source <> 'seed'`));
  assert.equal(d.national.farmers_male, await one(`SELECT count(*) AS n FROM farmers WHERE source <> 'seed' AND lower(gender) = 'male'`));
  assert.equal(d.national.farmers_female, await one(`SELECT count(*) AS n FROM farmers WHERE source <> 'seed' AND lower(gender) = 'female'`));
  assert.equal(d.national.farmers_unrecorded, await one(`SELECT count(*) AS n FROM farmers WHERE source <> 'seed' AND (gender IS NULL OR lower(gender) NOT IN ('male','female'))`));
  assert.equal(d.national.harvest_kg, await one(`SELECT round(sum(CASE WHEN unit = 'g' THEN quantity/1000 WHEN unit = 'lb' THEN quantity*0.45359237 WHEN unit = 'kg' THEN quantity END)) AS n FROM harvest_batches WHERE deleted_at IS NULL AND is_latest AND source <> 'seed' AND extract(year FROM harvest_date) = 2026`));
});

test('district view: small groups (fewer than 5 farmers) hide the gender split; larger ones show it', async () => {
  const db = await makeDb({ extraSinoe: true });
  const nimba = await detail(db, ID.admin, ID.nimba, 2026);
  assert.equal(nimba.county, 'Nimba');
  const sanni = nimba.districts.find((x) => x.district === 'Sanniquellie-Mahn');
  assert.deepEqual([sanni.farmers, sanni.farms, sanni.small_group, sanni.farmers_male, sanni.farmers_female, sanni.farmers_unrecorded], [2, 4, true, null, null, null], 'no exact split for fewer than 5');
  assert.equal(sanni.harvest_kg, 300, 'totals still shown');
  const gbeh = nimba.districts.find((x) => x.district === 'Gbehlageh');
  assert.deepEqual([gbeh.farmers, gbeh.farms, gbeh.harvest_kg, gbeh.small_group], [2, 2, 500, true], 'a farm whose district is only text is grouped under the same name');

  const sinoe = await detail(db, ID.admin, ID.sinoe, 2026);
  const green = sinoe.districts[0];
  assert.deepEqual([green.district, green.farmers, green.small_group, green.farmers_male, green.farmers_female, green.farmers_unrecorded], ['Greenville', 5, false, 3, 2, 0]);
});

test('county detail: top crops by kg, and the unassigned group', async () => {
  const db = await makeDb();
  const nimba = await detail(db, ID.admin, ID.nimba, 2026);
  assert.deepEqual(nimba.top_crops, [{ crop: 'Rice', harvest_kg: 750 }, { crop: 'Cassava', harvest_kg: 50 }]);
  const un = await detail(db, ID.admin, null, 2026);
  assert.equal(un.county, 'Unassigned county');
  assert.deepEqual([un.districts[0].farms, un.districts[0].harvest_kg], [1, 25]);
});

test('only an administrator can read the numbers; everyone else is refused', async () => {
  const db = await makeDb();
  for (const uid of [ID.inspector, ID.farmerUser, '00000000-0000-4000-8000-0000000000ff', null]) {
    await assert.rejects(insights(db, uid, 2026), /not_allowed/, `uid ${uid}`);
    await assert.rejects(detail(db, uid, ID.nimba, 2026), /not_allowed/, `uid ${uid}`);
  }
  assert.ok(await insights(db, ID.admin, 2026));
  assert.ok(await insights(db, ID.agri, 2026), 'an agricultural administrator can too');
});

test('the signed-out app key cannot call the functions at all, and the helpers are private', async () => {
  const db = await makeDb();
  await db.exec('SET ROLE anon');
  await assert.rejects(db.query('SELECT public.admin_county_insights(2026, NULL, false)'), /permission denied/i);
  await assert.rejects(db.query('SELECT * FROM public.insights_farm_base()'), /permission denied/i);
  await db.exec('RESET ROLE');
  await db.exec('SET ROLE authenticated');
  await assert.rejects(db.query('SELECT * FROM public.insights_farm_base()'), /permission denied/i, 'a signed-in user cannot read the raw base either');
  await db.exec('RESET ROLE');
});

test('the result holds counts and totals only: no names, phones, ids of a person or places of a farm', async () => {
  const db = await makeDb();
  const json = JSON.stringify([await insights(db, ID.admin, 2026), await detail(db, ID.admin, ID.nimba, 2026)]);
  for (const secret of ['Test m1', 'Test f1', 'full_name', 'phone', '00000000-0000-4000-8000-000000000100']) assert.ok(!json.includes(secret), `leaked: ${secret}`);
});
