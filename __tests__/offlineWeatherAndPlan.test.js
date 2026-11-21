const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/loadTs');
const { buildPlan } = require('../src/shared/farmPlan');
const { validateWeather } = require('../src/shared/activityWeather');

const FARM = '3f2b8c1e-9d4a-4b6f-8a7e-1c2d3e4f5a6b';
const FARMER = 'f0000000-0000-0000-0000-000000000001';

// The columns the live database has once the migration is applied.
const ACTIVITY_COLUMNS = [
  'id', 'farmer_id', 'farm_id', 'season_id', 'activity_type', 'activity_date', 'description', 'quantity', 'unit', 'cost',
  'labor_count', 'photo_url', 'recorded_by', 'weather_sky', 'rain_mm', 'day_feel', 'created_at', 'updated_at',
];
const PLAN_COLUMNS = ['id', 'farm_id', 'plan_year', 'crop', 'planting_date', 'change_note', 'created_at', 'updated_at', 'deleted_at'];

const newActivity = (extra = {}) => ({
  id: '11111111-aaaa-4bbb-8ccc-000000000001', farmer_id: FARMER, farm_id: FARM, season_id: null, activity_type: 'First weeding',
  activity_date: '2026-11-20', description: 'Weeded', quantity: null, unit: null, cost: 5, labor_count: 2, photo_url: null, recorded_by: null,
  ...validateWeather({ sky: 'rain', rainMm: '12', dayFeel: 'hot' }).values, sync_status: 'waiting_to_sync',
  created_at: '2026-11-20T08:00:00Z', updated_at: '2026-11-20T08:00:00Z', ...extra,
});

test('offline: an activity with weather and a plan are saved on the phone, then reach the server once, with no duplicates', async () => {
  const { localDb, syncEngine, server } = loadApp({ columns: { farm_activities: ACTIVITY_COLUMNS, farm_plans: PLAN_COLUMNS } });
  server.online = false; // no network

  // 1. saved on the phone while offline: both are queued, nothing has reached the server
  await localDb.saveActivity(newActivity(), true);
  const plan = buildPlan({ farmId: FARM, year: 2027, crop: 'Upland rice', plantingDate: '2027-05-10', changeNote: 'Weed earlier', now: new Date('2026-11-21T10:00:00Z') });
  await localDb.saveFarmPlan(plan, true);
  assert.equal((await localDb.getActivities(FARMER))[0].weather_sky, 'rain', 'readable on the phone straight away');
  assert.equal((await localDb.getFarmPlans(FARM)).length, 1);
  let queue = await localDb.getSyncQueue();
  assert.deepEqual(queue.map((q) => q.entity_type).sort(), ['activity', 'farm_plan']);

  // 2. a sync attempt with no network fails cleanly and loses nothing
  const failed = await syncEngine.syncQueue();
  assert.equal(failed.failureCount, 2);
  assert.equal(server.tables.farm_activities, undefined);
  queue = await localDb.getSyncQueue();
  assert.equal(queue.length, 2, 'both are still waiting');
  assert.ok(queue.every((q) => q.status === 'sync_failed'));

  // 3. the network comes back: both reach the server, once each, with the weather
  server.online = true;
  const ok = await syncEngine.syncQueue();
  assert.equal(ok.failureCount, 0);
  assert.equal(server.tables.farm_activities.size, 1);
  assert.equal(server.tables.farm_plans.size, 1);
  const a = [...server.tables.farm_activities.values()][0];
  assert.deepEqual([a.weather_sky, a.rain_mm, a.day_feel], ['rain', 12, 'hot']);
  const p = [...server.tables.farm_plans.values()][0];
  assert.deepEqual([p.id, p.farm_id, p.plan_year, p.crop, p.planting_date, p.change_note], [plan.id, FARM, 2027, 'Upland rice', '2027-05-10', 'Weed earlier']);
  assert.equal((await localDb.getSyncQueue()).length, 0, 'the queue is empty');

  // 4. syncing again does nothing new
  await syncEngine.syncQueue();
  assert.equal(server.tables.farm_activities.size, 1);
  assert.equal(server.tables.farm_plans.size, 1);
});

test('saving the plan again updates the one plan; the farmer\'s edit wins; delete is a tombstone', async () => {
  const { localDb, syncEngine, server } = loadApp({ columns: { farm_activities: ACTIVITY_COLUMNS, farm_plans: PLAN_COLUMNS } });
  await localDb.saveActivity(newActivity(), true);
  const first = buildPlan({ farmId: FARM, year: 2027, crop: 'Rice' });
  await localDb.saveFarmPlan(first, true);
  await syncEngine.syncQueue();

  // edit offline, then sync: same row, new values (the farmer's edit wins over what the server had)
  server.online = false;
  server.tables.farm_activities.values().next().value.rain_mm = 99; // something else changed it on the server
  await localDb.saveActivity(newActivity({ weather_sky: 'sunny', rain_mm: 0, day_feel: 'warm' }), true);
  const second = buildPlan({ farmId: FARM, year: 2027, crop: 'Cassava', existing: first });
  assert.equal(second.id, first.id);
  await localDb.saveFarmPlan(second, true);
  assert.equal((await localDb.getFarmPlans(FARM)).length, 1, 'still one plan on the phone');
  server.online = true;
  await syncEngine.syncQueue();
  assert.equal(server.tables.farm_plans.size, 1, 'still one plan on the server');
  assert.equal([...server.tables.farm_plans.values()][0].crop, 'Cassava');
  const a = [...server.tables.farm_activities.values()][0];
  assert.deepEqual([a.weather_sky, a.rain_mm, a.day_feel], ['sunny', 0, 'warm']);
  assert.equal(server.tables.farm_activities.size, 1);

  // delete: removed on the phone, and the server keeps a tombstone instead of losing the row
  await localDb.deleteFarmPlan(first.id, true);
  assert.equal((await localDb.getFarmPlans(FARM)).length, 0);
  await syncEngine.syncQueue();
  const tomb = [...server.tables.farm_plans.values()][0];
  assert.ok(tomb.deleted_at, 'tombstone set');
  assert.equal(server.tables.farm_plans.size, 1);

  // saving it again after a delete brings the same row back (no second plan)
  await localDb.saveFarmPlan(buildPlan({ farmId: FARM, year: 2027, crop: 'Maize' }), true);
  await syncEngine.syncQueue();
  assert.equal(server.tables.farm_plans.size, 1);
  const back = [...server.tables.farm_plans.values()][0];
  assert.equal(back.deleted_at, null);
  assert.equal(back.crop, 'Maize');
});

test('a database that has not had the migration yet still receives the activity, without the weather columns', async () => {
  const old = ACTIVITY_COLUMNS.filter((c) => !['weather_sky', 'rain_mm', 'day_feel'].includes(c));
  const { localDb, syncEngine, server } = loadApp({ columns: { farm_activities: old } });
  await localDb.saveActivity(newActivity(), true);
  const r = await syncEngine.syncQueue();
  assert.equal(r.failureCount, 0);
  const a = [...server.tables.farm_activities.values()][0];
  assert.ok(!('weather_sky' in a));
  assert.equal(a.activity_type, 'First weeding');
  // the weather is still on the phone
  assert.equal((await localDb.getActivities(FARMER))[0].weather_sky, 'rain');
});

test('old activities saved before the weather fields load with null weather', async () => {
  const { localDb, asyncStorage } = loadApp();
  const old = { id: 'old-1', farmer_id: FARMER, farm_id: FARM, activity_type: 'Weeding', activity_date: '2025-07-02', cost: 3, labor_count: 1, sync_status: 'synced', created_at: 'x', updated_at: 'x' };
  await asyncStorage.setItem('@agritrack_activities', JSON.stringify([old]));
  const [loaded] = await localDb.getActivities(FARMER);
  assert.deepEqual([loaded.weather_sky, loaded.rain_mm, loaded.day_feel], [null, null, null]);
  assert.equal(loaded.activity_type, 'Weeding');
  // reading did not rewrite the stored row
  assert.deepEqual(JSON.parse(await asyncStorage.getItem('@agritrack_activities')), [old]);
});
