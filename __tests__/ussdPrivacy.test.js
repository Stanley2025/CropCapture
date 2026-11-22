const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { handleUssd } = require('../server/ussd/menu');
const { createMemoryRepository } = require('../server/ussd/repository');
const { buildDemoRows } = require('../server/ussd/demoData');
const { createRequestHandler, createRepositoryFromEnv } = require('../server/index');

const NOW = new Date('2026-11-21T10:00:00Z');
const MUSU = '+231771000001'; // sample farmer (Kollie Rice Farm ...)
const SARAH = '+231771000009';
const OTHER = '+231771000010';
const REG = ['Sarah Johnson', 'Sarah Rice Farm', '1', '98', '12', '1', 'Gbehley', '2.5', '1', '1', '1', '2', '1,2', '1', '1'];
const dial = (repo, phone, inputs, sessionId = 's1') =>
  handleUssd({ sessionId, serviceCode: '*000#', phoneNumber: phone, text: inputs.join('*') }, { repo, weather: { getForecast: async () => [] }, now: () => NOW });

test('a farmer who registers sees only their own farm, never another farmer\'s', async () => {
  const repo = createMemoryRepository(buildDemoRows(NOW));
  await dial(repo, SARAH, REG);
  const mine = await dial(repo, SARAH, ['6', '1']);
  assert.match(mine, /Sarah Rice Farm/);
  for (const other of ['Kollie', 'Musu', 'Joseph']) assert.ok(!mine.includes(other), `Sarah saw ${other}`);
  const farmer = await repo.findFarmerByPhone(SARAH);
  assert.deepEqual((await repo.getFarms(farmer.id)).map((f) => f.name), ['Sarah Rice Farm']);
  // and the sample farmer does not see Sarah's farm
  assert.ok(!(await dial(repo, MUSU, ['6', '1'])).includes('Sarah'));
});

test('two farmers using the same session id and the same answers never share or overwrite a record', async () => {
  const repo = createMemoryRepository({ farmers: [], farms: [], farm_seasons: [], harvest_batches: [], expenses: [], quality_inspections: [] });
  await dial(repo, SARAH, REG, 'same-session');
  await dial(repo, OTHER, ['Peter Doe', ...REG.slice(1)], 'same-session');
  assert.equal(repo.db.farms.length, 2);
  assert.notEqual(repo.db.farms[0].id, repo.db.farms[1].id);
  assert.notEqual(repo.db.farms[0].farmer_id, repo.db.farms[1].farmer_id);
  for (const phone of [SARAH, OTHER]) {
    const f = await repo.findFarmerByPhone(phone);
    assert.equal((await repo.getFarms(f.id)).length, 1, phone);
  }
});

test('a new phone with nothing registered sees nothing of anyone else', async () => {
  const repo = createMemoryRepository(buildDemoRows(NOW));
  const reply = await dial(repo, OTHER, []);
  assert.match(reply, /not registered/);
  for (const other of ['Kollie', 'Musu', 'Joseph', 'Rice Farm']) assert.ok(!reply.includes(other));
});

test('the demo server starts with no sample farmers unless they are asked for', () => {
  const empty = createRepositoryFromEnv({ USSD_STORE: 'memory' });
  assert.equal(empty.db.farmers.length, 0);
  assert.equal(empty.db.farms.length, 0);
  const demo = createRepositoryFromEnv({ USSD_STORE: 'memory', USSD_DEMO_DATA: '1' });
  assert.ok(demo.db.farmers.length > 0);
});

async function start(opts) {
  const repo = createMemoryRepository(buildDemoRows(NOW));
  const server = http.createServer(createRequestHandler({ repo, weather: { getForecast: async () => [] }, ...opts }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

test('the records API is off without a key, and needs the right key when one is set', async () => {
  const off = await start({ apiKey: undefined });
  for (const path of ['/api/farms', '/api/harvests', '/api/inspections', '/api/reports/commercial']) {
    assert.equal((await fetch(off.url + path)).status, 403, path);
  }
  await off.close();

  const on = await start({ apiKey: 'secret-key' });
  assert.equal((await fetch(on.url + '/api/farms')).status, 401);
  assert.equal((await fetch(on.url + '/api/farms', { headers: { 'x-api-key': 'wrong' } })).status, 401);
  assert.equal((await fetch(on.url + '/api/farms', { headers: { 'x-api-key': 'secret-key' } })).status, 200);
  assert.equal((await fetch(on.url + '/api/farms', { headers: { Authorization: 'Bearer secret-key' } })).status, 200);
  assert.equal((await fetch(on.url + '/health')).status, 200, 'the health check stays open');
  await on.close();
});

test('the public activity feed shows no full names and no farm names; the key shows everything', async () => {
  const on = await start({ apiKey: 'secret-key' });
  const open = await (await fetch(on.url + '/api/activity')).json();
  assert.ok(open.items.length > 0);
  for (const item of open.items) {
    assert.equal(item.farm, '');
    assert.ok(!/\s\w{2,}$/.test(item.farmer), `full name shown: ${item.farmer}`);
  }
  const full = await (await fetch(on.url + '/api/activity', { headers: { 'x-api-key': 'secret-key' } })).json();
  assert.ok(full.items.some((i) => i.farm));
  await on.close();
});
