const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/loadTs');

// What the live database does with farm_activities.recorded_by: it must be a staff PROFILE, and a farmer is not one.
const rules = {
  farm_activities: (row) => (row.recorded_by ? 'insert or update on table "farm_activities" violates foreign key constraint "farm_activities_recorded_by_fkey"' : null),
};

const ACTIVITY = (extra = {}) => ({
  id: 'a1', farmer_id: 'f1', farm_id: 'farm1', season_id: null, activity_type: 'Weeding', activity_date: '2026-11-22',
  description: 'weeded', quantity: null, unit: null, cost: 10, currency: 'USD', labor_count: 2, photo_url: null,
  created_at: '2026-11-22T08:00:00Z', ...extra,
});

for (const [label, recordedBy] of [
  ['the farmer\'s own id (a real uuid that is not a staff profile)', '6f1d1b6e-3b0a-4f7c-9d2e-0a1b2c3d4e5f'],
  ['the app\'s built-in profile id', 'p0000000-0000-0000-0000-000000000001'],
]) {
  test(`an activity recorded with ${label} still reaches the database`, async () => {
    const { localDb, syncEngine, server } = loadApp();
    server.rules = rules;
    await localDb.saveActivity(ACTIVITY({ recorded_by: recordedBy }), true);
    const r = await syncEngine.syncQueue();
    assert.equal(r.failureCount, 0, JSON.stringify(r.errors));
    const row = server.tables.farm_activities.get('a1');
    assert.equal(row.activity_type, 'Weeding');
    assert.equal(row.farmer_id, 'f1', 'the farmer is still identified');
    assert.equal(row.recorded_by, null);
  });
}

test('activities that failed before are sent on the next sync once the payload is fixed', async () => {
  const { localDb, syncEngine, server } = loadApp();
  server.rules = rules;
  // an old queue item, saved with the bad field, that failed before
  await localDb.saveActivity(ACTIVITY({ recorded_by: '6f1d1b6e-3b0a-4f7c-9d2e-0a1b2c3d4e5f' }), true);
  const queue = await localDb.getSyncQueue();
  await localDb.updateSyncQueueItem(queue[0].id, { status: 'sync_failed', retry_count: 3, last_error: 'violates foreign key constraint' });
  const r = await syncEngine.syncQueue();
  assert.equal(r.failureCount, 0);
  assert.ok(server.tables.farm_activities.has('a1'));
});
