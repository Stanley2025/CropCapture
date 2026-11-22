/**
 * A real Postgres (PGlite, in memory, nothing leaves this computer) with the tables the Counties section
 * reads, the real migration loaded, and a small dataset whose numbers are worked out by hand.
 */
const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');

const u = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ID = {
  admin: u(900), agri: u(901), inspector: u(902), farmerUser: u(903),
  nimba: u(1), bong: u(2), lofa: u(3), sinoe: u(4),
  rice: u(11), cassava: u(12),
  dSanni: u(21), dGbeh: u(22),
};

const SCHEMA = `
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE TABLE profiles (id uuid PRIMARY KEY, role text);
  CREATE TABLE counties (id uuid PRIMARY KEY, name text UNIQUE NOT NULL, code text);
  CREATE TABLE districts (id uuid PRIMARY KEY, county_id uuid, name text);
  CREATE TABLE crops (id uuid PRIMARY KEY, name text UNIQUE NOT NULL);
  CREATE TABLE farmers (id uuid PRIMARY KEY, full_name text, gender text, county text, source text NOT NULL DEFAULT 'app', created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE farms (id uuid PRIMARY KEY, farmer_id uuid NOT NULL REFERENCES farmers(id), county text, county_id uuid, district text, district_id uuid, source text NOT NULL DEFAULT 'app', created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE harvest_batches (id uuid PRIMARY KEY, farm_id uuid, farmer_id uuid, crop_id uuid, harvest_date date, quantity numeric, unit text, quantity_kg numeric, kg_per_unit numeric, status text NOT NULL DEFAULT 'submitted', deleted_at timestamptz, is_latest boolean NOT NULL DEFAULT true, source text NOT NULL DEFAULT 'app');
`;

async function insert(db, table, rows) {
  for (const r of rows) {
    const cols = Object.keys(r);
    await db.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`, cols.map((c) => r[c]));
  }
}

/**
 * The dataset (all harvests in 2026 unless said):
 *   Nimba   4 farmers (3 M, 1 F)  6 farms  800 kg (M 500, F 300)
 *   Bong    4 farmers (2 M, 1 F, 1 not recorded)  5 farms  700 kg (M 400, F 200, ? 100)
 *   Lofa    2 farmers (1 M, 1 F)  2 farms  800 kg (M 300, F 500)
 *   Unassigned county: 1 farm (a misspelled county) 25 kg
 *   Sinoe   nothing recorded
 */
async function makeDb({ extraSinoe = false } = {}) {
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261130_county_insights.sql'), 'utf8'));

  await insert(db, 'profiles', [
    { id: ID.admin, role: 'super_admin' }, { id: ID.agri, role: 'agricultural_admin' },
    { id: ID.inspector, role: 'quality_inspector' }, { id: ID.farmerUser, role: 'farmer' },
  ]);
  await insert(db, 'counties', [{ id: ID.nimba, name: 'Nimba', code: 'NM' }, { id: ID.bong, name: 'Bong', code: 'BG' }, { id: ID.lofa, name: 'Lofa', code: 'LF' }, { id: ID.sinoe, name: 'Sinoe', code: 'SI' }]);
  await insert(db, 'districts', [{ id: ID.dSanni, county_id: ID.nimba, name: 'Sanniquellie-Mahn' }, { id: ID.dGbeh, county_id: ID.nimba, name: 'Gbehlageh' }]);
  await insert(db, 'crops', [{ id: ID.rice, name: 'Rice' }, { id: ID.cassava, name: 'Cassava' }]);

  // 10 farmers: 6 male, 3 female, 1 not recorded. Counties are written the way people write them.
  const farmers = [
    ['m1', 'Male', 'Nimba'], ['m2', 'Male', 'Nimba'], ['m3', 'Male', 'Nimba'], ['f1', 'Female', 'Nimba'],
    ['m4', 'Male', 'Bong'], ['m5', 'Male', 'Bong'], ['f2', 'Female', 'bong '], ['u1', null, 'Bongo'], // "Bongo" is a misspelling: the farm decides
    ['m6', 'Male', 'Lofa'], ['f3', 'Female', 'Lofa County'],
  ];
  const fid = Object.fromEntries(farmers.map(([k], i) => [k, u(100 + i)]));
  await insert(db, 'farmers', farmers.map(([k, gender, county]) => ({ id: fid[k], full_name: `Test ${k}`, gender, county })));
  await insert(db, 'farmers', [{ id: u(199), full_name: 'Sample farmer', gender: 'Male', county: 'Nimba', source: 'seed' }]);

  const farm = (n, owner, extra) => ({ id: u(200 + n), farmer_id: fid[owner], ...extra });
  const FARM = (k) => u(200 + k);
  await insert(db, 'farms', [
    farm(1, 'm1', { county_id: ID.nimba, district_id: ID.dSanni }), farm(2, 'm1', { county_id: ID.nimba, district_id: ID.dSanni }), farm(3, 'm1', { county_id: ID.nimba, district_id: ID.dSanni }), // one farmer, 3 farms
    farm(4, 'm2', { county: 'Nimba', district: 'Gbehlageh' }),         // county only as text
    farm(5, 'm3', { county_id: ID.nimba, district_id: ID.dSanni }),
    farm(6, 'f1', { county_id: ID.nimba, district_id: ID.dGbeh }),
    farm(7, 'm4', { county_id: ID.bong, district: 'Suakoko' }), farm(8, 'm5', { county_id: ID.bong, district: 'Suakoko' }),
    farm(9, 'f2', { county_id: ID.bong, district: 'Suakoko' }), farm(10, 'f2', { county_id: ID.bong }),
    farm(11, 'u1', { county: 'BONG' }),
    farm(12, 'm6', { county_id: ID.lofa }), farm(13, 'f3', { county_id: ID.lofa }),
    farm(14, 'm6', { county: 'Nimbaa' }),                              // misspelled: Unassigned county
    { id: FARM(15), farmer_id: u(199), county_id: ID.nimba, source: 'seed' }, // sample farm
  ]);

  const h = (n, farmNo, extra) => ({ id: u(300 + n), farm_id: FARM(farmNo), farmer_id: null, crop_id: ID.rice, harvest_date: '2026-08-15', unit: 'kg', ...extra });
  await insert(db, 'harvest_batches', [
    h(1, 1, { quantity: 100 }), h(2, 2, { quantity: 50, crop_id: ID.cassava }), h(3, 4, { quantity: 200, status: 'approved' }),
    h(4, 5, { quantity: 150000, unit: 'g' }),                           // 150 kg, written in grams
    h(5, 6, { quantity: 300 }),
    h(6, 7, { quantity: 400, status: 'approved' }), h(7, 9, { quantity: 120 }), h(8, 10, { quantity: 80 }), h(9, 11, { quantity: 100 }),
    h(10, 8, { quantity: 10, unit: 'bags' }),                           // no weight: cannot be turned into kg
    h(11, 12, { quantity: 300 }), h(12, 13, { quantity: 1102.31131, unit: 'lb' }), // 500 kg, written in pounds
    h(13, 14, { quantity: 25 }),
    // never counted:
    h(20, 1, { quantity: 1000, deleted_at: '2026-09-01T00:00:00Z' }),   // deleted
    h(21, 7, { quantity: 777, is_latest: false }),                      // replaced by a newer edit
    h(22, 15, { quantity: 5000, source: 'seed' }),                      // sample record
    // another year
    h(23, 6, { quantity: 40, harvest_date: '2025-08-15' }),
  ]);

  if (extraSinoe) {
    const extra = [['s1', 'Male'], ['s2', 'Male'], ['s3', 'Male'], ['s4', 'Female'], ['s5', 'Female']];
    await insert(db, 'farmers', extra.map(([k, g], i) => ({ id: u(400 + i), full_name: `Test ${k}`, gender: g, county: 'Sinoe' })));
    await insert(db, 'farms', extra.map((_, i) => ({ id: u(450 + i), farmer_id: u(400 + i), county_id: ID.sinoe, district: 'Greenville' })));
  }

  return db;
}

/** Call a function as a given signed-in user (or nobody). */
async function asUser(db, uid, sql, params = []) {
  await db.query(`SELECT set_config('test.uid', $1, false)`, [uid || '']);
  return db.query(sql, params);
}

const insights = async (db, uid, year = null, crop = null, approved = false) =>
  (await asUser(db, uid, 'SELECT public.admin_county_insights($1::int, $2::uuid, $3::boolean) AS r', [year, crop, approved])).rows[0].r;

const detail = async (db, uid, county, year = null, crop = null, approved = false) =>
  (await asUser(db, uid, 'SELECT public.admin_county_detail($1::uuid, $2::int, $3::uuid, $4::boolean) AS r', [county, year, crop, approved])).rows[0].r;

module.exports = { makeDb, asUser, insights, detail, ID, u };
