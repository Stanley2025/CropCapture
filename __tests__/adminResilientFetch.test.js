const test = require('node:test');
const assert = require('node:assert/strict');

// The admin's wrapper is plain TypeScript with no imports; Node strips the types when loading it.
const R = require('../admin/src/lib/supabase/resilientFetch.ts');

/**
 * A fake PostgREST: knows which columns each table has, and answers 400 with the same
 * messages the real one uses when a selected column or join does not exist.
 */
function fakeDatabase(schema, noJoins = []) {
  const calls = [];
  const base = async (input) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    calls.push(url.searchParams.get('select'));
    const table = url.pathname.split('/rest/v1/')[1];
    const err = (message) => new Response(JSON.stringify({ code: '42703', message }), { status: 400 });
    const check = (tbl, select, alias) => {
      const splitTop = (s) => {
        const out = []; let d = 0; let cur = '';
        for (const c of s) { if (c === '(') d++; if (c === ')') d--; if (c === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += c; }
        if (cur.trim()) out.push(cur.trim());
        return out;
      };
      for (const item of splitTop(select)) {
        const open = item.indexOf('(');
        if (open > -1) {
          const child = item.slice(0, open).split(':').pop().split('!')[0].trim();
          if (noJoins.includes(`${tbl}>${child}`)) return `Could not find a relationship between '${tbl}' and '${child}' in the schema cache`;
          const inner = check(child, item.slice(open + 1, -1), `${child}_1`);
          if (inner) return inner;
        } else {
          const col = item.split(':').pop().trim();
          if (col !== '*' && !schema[tbl].includes(col)) return `column ${alias || tbl}.${col} does not exist`;
        }
      }
      return null;
    };
    const problem = check(table, url.searchParams.get('select') || '*');
    if (problem) return err(problem);
    return new Response(JSON.stringify([{ ok: true }]), { status: 200 });
  };
  return { base, calls };
}

const SCHEMA = {
  farmers: ['id', 'full_name', 'phone_number', 'created_at'],
  farms: ['id', 'name', 'farmer_id', 'latitude'],
  cooperatives: ['id', 'name'],
};
const FARMERS_SELECT = 'id, full_name, id_number, phone, phone_number, status, cooperative:cooperatives(id, name, code, county)';
const get = (f, table, select) => f(`https://x.supabase.co/rest/v1/${table}?select=${encodeURIComponent(select)}&order=created_at.desc`, { method: 'GET' });

test('a query that selects columns the database lacks still returns data', async () => {
  R.resetDroppedSchemaParts();
  const db = fakeDatabase(SCHEMA);
  const f = R.createResilientFetch(db.base);
  const res = await get(f, 'farmers', FARMERS_SELECT);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), [{ ok: true }]);
  const dropped = R.getDroppedSchemaParts();
  assert.deepEqual(dropped.columns.farmers.sort(), ['id_number', 'phone', 'status']);
  assert.deepEqual(dropped.columns.cooperatives.sort(), ['code', 'county'], 'columns missing inside a join are dropped from the join only');
  // what is sent last is exactly the columns that exist, with the join kept
  assert.equal(db.calls.at(-1), 'id,full_name,phone_number,cooperative:cooperatives(id,name)');
});

test('what was dropped is remembered, so the next request succeeds first time', async () => {
  R.resetDroppedSchemaParts();
  const db = fakeDatabase(SCHEMA);
  const f = R.createResilientFetch(db.base);
  await get(f, 'farmers', FARMERS_SELECT);
  const before = db.calls.length;
  const res = await get(f, 'farmers', FARMERS_SELECT);
  assert.equal(res.status, 200);
  assert.equal(db.calls.length, before + 1, 'one request, no retries');
});

test('a join the database cannot make is dropped, the rest is kept', async () => {
  R.resetDroppedSchemaParts();
  const db = fakeDatabase(SCHEMA, ['farms>farmers']);
  const f = R.createResilientFetch(db.base);
  const res = await get(f, 'farms', 'id, name, farmer:farmers(id, full_name)');
  assert.equal(res.status, 200);
  assert.equal(db.calls.at(-1), 'id,name');
  assert.deepEqual(R.getDroppedSchemaParts().joins, { farms: ['farmers'] });
});

test('a second embed of the same table (farmers_1) is understood', async () => {
  R.resetDroppedSchemaParts();
  const db = fakeDatabase({ ...SCHEMA, farmers: ['id', 'full_name'] });
  const f = R.createResilientFetch(db.base);
  const res = await get(f, 'farms', 'id, farmer:farmers(id, full_name, farmer_id_code)');
  assert.equal(res.status, 200);
  assert.deepEqual(R.getDroppedSchemaParts().columns.farmers, ['farmer_id_code']);
});

test('real errors are returned untouched, and writes are never rewritten', async () => {
  R.resetDroppedSchemaParts();
  const denied = R.createResilientFetch(async () => new Response(JSON.stringify({ message: 'permission denied for table farmers' }), { status: 403 }));
  assert.equal((await get(denied, 'farmers', 'id')).status, 403);

  const badFilter = R.createResilientFetch(async () => new Response(JSON.stringify({ message: 'invalid input syntax for type uuid: "x"' }), { status: 400 }));
  const r = await get(badFilter, 'farmers', 'id');
  assert.equal(r.status, 400);
  assert.match((await r.json()).message, /invalid input syntax/);

  let sent = 0;
  const post = R.createResilientFetch(async () => { sent++; return new Response(JSON.stringify({ message: 'column farms.zzz does not exist' }), { status: 400 }); });
  const w = await post('https://x.supabase.co/rest/v1/farms?select=id', { method: 'POST', body: '{}' });
  assert.equal(w.status, 400);
  assert.equal(sent, 1, 'an insert that fails is not retried with fewer columns');
  assert.deepEqual(R.getDroppedSchemaParts(), { columns: {}, joins: {} });
});

test('it gives up when nothing more can be dropped (no endless retries)', async () => {
  R.resetDroppedSchemaParts();
  let calls = 0;
  const f = R.createResilientFetch(async () => { calls++; return new Response(JSON.stringify({ message: 'column farms.id does not exist' }), { status: 400 }); });
  const res = await get(f, 'farms', 'id');
  assert.equal(res.status, 400);
  assert.ok(calls <= 3, `stopped after ${calls} calls`);
  const star = R.createResilientFetch(async () => { calls = 0; calls++; return new Response(JSON.stringify({ message: 'column farms.x does not exist' }), { status: 400 }); });
  assert.equal((await get(star, 'farms', '*')).status, 400);
  assert.equal(calls, 1);
});

test('pruneSelect keeps aliases, joins and column order', () => {
  R.resetDroppedSchemaParts();
  assert.equal(R.pruneSelect('farms', 'id, name, farmer:farmers(id, full_name)'), 'id,name,farmer:farmers(id, full_name)'.replace('id, full_name', 'id,full_name'));
});
