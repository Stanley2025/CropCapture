const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/loadTs');
const path = require('path');

const FARMS = [
  { id: 'farm-a1', farmer_id: 'farmer-a', name: 'A first' },
  { id: 'farm-a2', farmer_id: 'farmer-a', name: 'A second' },
  { id: 'farm-b1', farmer_id: 'farmer-b', name: 'B first' },
  { id: 'farm-c1', farmer_id: 'farmer-c', name: 'C first' },
];

async function setup() {
  const app = loadApp();
  for (const f of FARMS) await app.localDb.saveFarm(f, false);
  // a fresh copy each time, so it reads the fresh in-memory store of this test
  const file = path.resolve(__dirname, '../src/services/access/visibility.ts');
  delete require.cache[file];
  const { getScope } = require(file);
  return { ...app, getScope };
}
const names = (list) => list.map((f) => f.name).sort();

test('a farmer sees only their own farms and records', async () => {
  const { localDb, getScope } = await setup();
  const scope = await getScope('farmer', 'p-a', 'farmer-a');
  assert.deepEqual(names((await localDb.getFarms()).filter(scope.farm)), ['A first', 'A second']);
  assert.equal(scope.row({ farm_id: 'farm-b1' }), false);
  assert.equal(scope.row({ farmer_id: 'farmer-b' }), false);
  assert.equal(scope.row({ farm_id: 'farm-a2' }), true);
});

test('an extension officer with no assignments sees nothing from the farmers on the phone', async () => {
  const { localDb, getScope } = await setup();
  const scope = await getScope('extension_officer', 'officer-1', null);
  assert.deepEqual((await localDb.getFarms()).filter(scope.farm), []);
  assert.equal(scope.row({ farm_id: 'farm-a1', farmer_id: 'farmer-a' }), false);
});

test('an extension officer sees only the farmers (or the one farm) assigned to them', async () => {
  const { localDb, getScope } = await setup();
  await localDb.saveExtensionAssignments('officer-1', [
    { id: 'x1', officer_id: 'officer-1', farmer_id: 'farmer-a', farm_id: null, status: 'active' },
    { id: 'x2', officer_id: 'officer-1', farmer_id: 'farmer-b', farm_id: 'farm-b1', status: 'active' },
  ]);
  await localDb.saveExtensionAssignments('officer-2', [{ id: 'x3', officer_id: 'officer-2', farmer_id: 'farmer-c', farm_id: null, status: 'active' }]);

  const one = await getScope('extension_officer', 'officer-1', null);
  assert.deepEqual(names((await localDb.getFarms()).filter(one.farm)), ['A first', 'A second', 'B first']);
  assert.equal(one.row({ farm_id: 'farm-c1' }), false, 'another officer\'s farmer');

  const two = await getScope('extension_officer', 'officer-2', null);
  assert.deepEqual(names((await localDb.getFarms()).filter(two.farm)), ['C first']);

  // an assignment that is no longer active shows nothing
  await localDb.saveExtensionAssignments('officer-2', [{ id: 'x3', officer_id: 'officer-2', farmer_id: 'farmer-c', status: 'ended' }]);
  assert.deepEqual((await localDb.getFarms()).filter((await getScope('extension_officer', 'officer-2', null)).farm), []);
});

test('a buyer sees no farm records at all', async () => {
  const { localDb, getScope } = await setup();
  const scope = await getScope('buyer', 'b-1', null);
  assert.deepEqual((await localDb.getFarms()).filter(scope.farm), []);
});

test('staff roles with a wider view are not restricted', async () => {
  const { localDb, getScope } = await setup();
  const scope = await getScope('quality_inspector', 'i-1', null);
  assert.equal(scope.restricted, false);
  assert.equal((await localDb.getFarms()).filter(scope.farm).length, 4);
});
