const test = require('node:test');
const assert = require('node:assert/strict');
const { makeDb, ID } = require('./helpers/countyDb');
const { loadAdmin, stub } = require('./helpers/loadAdminTs');

let current = null;
stub('@/lib/counties/server', {
  countyService: { insights: (...a) => current.insights(...a), detail: (...a) => current.detail(...a) },
  listCrops: async () => [{ id: ID.rice, name: 'Rice' }, { id: ID.cassava, name: 'Cassava' }],
});
const S = loadAdmin('lib/counties/service.ts');
const route = loadAdmin('app/dashboard/counties/export/route.ts');

function clientFor(db, uid) {
  const sqlFor = {
    is_insights_admin: ['SELECT public.is_insights_admin() AS r', () => []],
    admin_county_insights: ['SELECT public.admin_county_insights($1::int, $2::uuid, $3::boolean) AS r', (a) => [a.p_year, a.p_crop, a.p_approved_only]],
    admin_county_detail: ['SELECT public.admin_county_detail($1::uuid, $2::int, $3::uuid, $4::boolean) AS r', (a) => [a.p_county, a.p_year, a.p_crop, a.p_approved_only]],
  };
  return {
    auth: { getUser: async () => ({ data: { user: uid ? { id: uid } : null } }) },
    rpc: async (name, args = {}) => {
      const [sql, params] = sqlFor[name];
      try {
        await db.query(`SELECT set_config('test.uid', $1, false)`, [uid || '']);
        return { data: (await db.query(sql, params(args))).rows[0].r, error: null };
      } catch (e) {
        return { data: null, error: { message: e.message } };
      }
    },
  };
}
const get = async (db, uid, query) => {
  current = S.createCountyService(async () => clientFor(db, uid));
  return route.GET(new Request(`http://localhost/dashboard/counties/export?${query}`));
};

test('Download CSV gives the table for the filters in the address, with the filters and the time on the last line', async () => {
  const db = await makeDb();
  const res = await get(db, ID.admin, 'year=2026&status=all&sort=county&dir=asc');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type'), /text\/csv/);
  assert.match(res.headers.get('Content-Disposition'), /^attachment; filename="farmtori-counties-2026-\d{4}-\d{2}-\d{2}\.csv"$/);
  assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
  const body = (await res.text()).replace(/^﻿/, '');
  const lines = body.trim().split('\r\n');
  assert.equal(lines[0].split(',')[0], 'County');
  assert.deepEqual(lines.slice(1, 6).map((l) => l.split(',')[0]), ['Bong', 'Lofa', 'Nimba', 'Sinoe', 'Unassigned county']);
  assert.equal(lines[3], 'Nimba,4,6,800,3,1,0,5,1,0,500,300,0', 'the same numbers as the table');
  assert.match(lines[6], /^Filters: Year=2026; Crop=All crops; Status=All records,Created: \d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
});

test('the file follows the crop and status filters and names them', async () => {
  const db = await makeDb();
  const res = await get(db, ID.admin, `year=all&crop=${ID.cassava}&status=approved`);
  const lines = (await res.text()).trim().split('\r\n');
  assert.match(lines.pop(), /^Filters: Year=All years; Crop=Cassava; Status=Approved records only,Created: /);
  assert.ok(lines.every((l) => !/Test /.test(l)), 'no personal details in the file');
});

test('signed-out, non-admin and database errors never produce a file with numbers', async () => {
  const db = await makeDb();
  assert.equal((await get(db, null, 'year=2026')).status, 401);
  assert.equal((await get(db, ID.inspector, 'year=2026')).status, 403);
  assert.equal((await get(db, ID.farmerUser, 'year=2026')).status, 403);
  const body = await (await get(db, ID.inspector, 'year=2026')).text();
  assert.ok(!/Nimba|\d{3}/.test(body));

  current = S.createCountyService(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: ID.admin } } }) },
    rpc: async (name) => (name === 'is_insights_admin' ? { data: true, error: null } : { data: null, error: { message: 'boom' } }),
  }));
  assert.equal((await route.GET(new Request('http://localhost/dashboard/counties/export?year=2026'))).status, 502);
});
