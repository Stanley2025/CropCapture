const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');
const { u, ID } = require('../helpers/countyDb');

// 50,000 farmers and 200,000 harvests of GENERATED data, in a throwaway in-memory Postgres copy (never the live database).
test('50,000 farmers and 200,000 harvests: the county numbers are computed on generated data (limit explained below)', async () => {
  const db = new PGlite();
  await db.exec(`
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
    -- indexes the live database already has
    CREATE INDEX idx_farms_county_id ON farms(county_id);
    CREATE INDEX idx_harvest_batches_farm_date ON harvest_batches(farm_id, harvest_date);
  `);
  await db.exec(fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261130_county_insights.sql'), 'utf8'));

  await db.query(`INSERT INTO profiles VALUES ($1, 'super_admin')`, [ID.admin]);
  const NAMES = ['Bomi', 'Bong', 'Gbarpolu', 'Grand Bassa', 'Grand Cape Mount', 'Grand Gedeh', 'Grand Kru', 'Lofa', 'Margibi', 'Maryland', 'Montserrado', 'Nimba', 'River Gee', 'Rivercess', 'Sinoe'];
  await db.exec(`CREATE TEMP TABLE names (n int, name text)`);
  for (const [i, name] of NAMES.entries()) await db.query('INSERT INTO names VALUES ($1, $2)', [i + 1, name]);
  await db.exec(`INSERT INTO counties SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, name, 'C' || n FROM names`);
  await db.exec(`INSERT INTO crops SELECT ('00000000-0000-4000-8000-' || lpad((10 + n)::text, 12, '0'))::uuid, 'Crop ' || n FROM generate_series(1, 9) n`);
  await db.exec(`INSERT INTO farmers (id, full_name, gender, county)
    SELECT ('10000000-0000-4000-8000-' || lpad(g.n::text, 12, '0'))::uuid, 'Generated ' || g.n,
           CASE g.n % 10 WHEN 0 THEN NULL WHEN 1 THEN 'Female' WHEN 2 THEN 'Female' WHEN 3 THEN 'Female' ELSE 'Male' END,
           (SELECT name FROM names WHERE names.n = 1 + g.n % 15)
    FROM generate_series(1, 50000) g(n)`);
  await db.exec(`INSERT INTO farms (id, farmer_id, county_id)
    SELECT ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, ('10000000-0000-4000-8000-' || lpad((1 + n % 50000)::text, 12, '0'))::uuid,
           ('00000000-0000-4000-8000-' || lpad((1 + n % 15)::text, 12, '0'))::uuid
    FROM generate_series(1, 70000) n`);
  await db.exec(`INSERT INTO harvest_batches (id, farm_id, crop_id, harvest_date, quantity, unit, status)
    SELECT ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, ('20000000-0000-4000-8000-' || lpad((1 + n % 70000)::text, 12, '0'))::uuid,
           ('00000000-0000-4000-8000-' || lpad((11 + n % 9)::text, 12, '0'))::uuid, date '2026-01-01' + (n % 300), 20 + n % 500, 'kg',
           CASE WHEN n % 3 = 0 THEN 'approved' ELSE 'submitted' END
    FROM generate_series(1, 200000) n`);
  await db.exec('ANALYZE');
  await db.query(`SELECT set_config('test.uid', $1, false)`, [ID.admin]);

  const counts = (await db.query('SELECT (SELECT count(*) FROM farmers)::int AS f, (SELECT count(*) FROM harvest_batches)::int AS h')).rows[0];
  assert.deepEqual(counts, { f: 50000, h: 200000 });

  const timed = async (label, sql, params) => {
    const t0 = performance.now();
    const r = await db.query(sql, params);
    const ms = Math.round(performance.now() - t0);
    console.log(`# ${label}: ${ms} ms`);
    return { ms, r: r.rows[0].r };
  };
  const warm = await timed('counties, year 2026', 'SELECT public.admin_county_insights(2026, NULL, false) AS r');
  const second = await timed('counties, year 2026 (second call)', 'SELECT public.admin_county_insights(2026, NULL, false) AS r');
  const crop = await timed('counties, one crop, approved only', 'SELECT public.admin_county_insights(2026, $1::uuid, true) AS r', [u(11)]);
  const detail = await timed('one county in detail', 'SELECT public.admin_county_detail($1::uuid, 2026, NULL, false) AS r', [u(1)]);

  assert.equal(warm.r.national.farmers, 50000);
  assert.equal(warm.r.counties.length, 16);
  // This runs in PGlite (Postgres compiled to WebAssembly, one thread), which is about 10 times slower than a normal
  // Postgres server (a plain 3-table join with a GROUP BY over the same data takes ~2.5 s here). So the limit below is
  // a guard against the query getting slower, NOT proof of the 2-second target on a real server: check that with
  // EXPLAIN ANALYZE on a staging copy of the database (see the final report).
  const LIMIT_MS = Number(process.env.COUNTY_PERF_LIMIT_MS || 12000);
  for (const t of [warm, second, crop, detail]) assert.ok(t.ms < LIMIT_MS, `took ${t.ms} ms (limit ${LIMIT_MS})`);
  // the answer is the real total: every generated harvest is in 2026 and is 20..519 kg
  const direct = Number((await db.query(`SELECT sum(quantity) AS n FROM harvest_batches WHERE extract(year FROM harvest_date) = 2026`)).rows[0].n);
  assert.equal(warm.r.national.harvest_kg, direct);
});
