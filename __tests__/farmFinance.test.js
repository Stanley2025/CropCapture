const test = require('node:test');
const assert = require('node:assert/strict');
const { profitAndLoss } = require('../src/shared/farmFinance');

const H = (date, quantity, extra = {}) => ({ id: `h${date}`, farm_id: 'f1', harvest_date: date, quantity, unit: 'kg', ...extra });
const E = (date, amount, extra = {}) => ({ id: `e${date}`, farm_id: 'f1', expense_date: date, amount, currency: 'USD', ...extra });

test('profit: money in is the sale value the farmer entered; money out is every cost', () => {
  const r = profitAndLoss({
    harvests: [H('2026-09-01', 500, { total_value: 400 })],
    expenses: [E('2026-05-01', 60)],
    inputs: [{ id: 'i', farm_id: 'f1', purchase_date: '2026-04-20', cost: 35, currency: 'USD' }],
    activities: [{ id: 'a', farm_id: 'f1', activity_date: '2026-06-02', cost: 25 }, { id: 'b', farm_id: 'f1', activity_date: '2026-06-03', cost: 0 }],
  });
  assert.deepEqual([r.moneyIn, r.recordedIn, r.estimatedIn, r.estimatedCount], [400, 400, 0, 0]);
  assert.equal(r.moneyOut, 120); // 60 + 35 + 25
  assert.equal(r.result, 280);
  assert.equal(r.isProfit, true);
});

test('loss: costs larger than money in give a negative result', () => {
  const r = profitAndLoss({ harvests: [H('2026-09-01', 100, { total_value: 50 })], expenses: [E('2026-05-01', 200)] });
  assert.equal(r.result, -150);
  assert.equal(r.isProfit, false);
});

test('a harvest with no sale value is counted at the reference price and reported as an estimate', () => {
  const r = profitAndLoss({ harvests: [H('2026-09-01', 1000), H('2026-09-05', 10, { total_value: 30 })] });
  assert.equal(r.estimatedCount, 1);
  assert.equal(r.estimatedIn, 450); // 1000 kg x 0.45
  assert.equal(r.recordedIn, 30);
  assert.equal(r.moneyIn, 480);
});

test('year and farm filters use the date of each record', () => {
  const data = {
    harvests: [H('2025-12-31', 100, { total_value: 10 }), H('2026-01-01', 100, { total_value: 20 }), { ...H('2026-02-01', 100, { total_value: 99 }), farm_id: 'f2' }],
    expenses: [E('2025-12-31', 1), E('2026-01-01', 2)],
  };
  assert.deepEqual([profitAndLoss({ ...data, year: 2025 }).moneyIn, profitAndLoss({ ...data, year: 2025 }).moneyOut], [10, 1]);
  assert.deepEqual([profitAndLoss({ ...data, year: 2026, farmIds: ['f1'] }).moneyIn, profitAndLoss({ ...data, year: 2026, farmIds: ['f1'] }).moneyOut], [20, 2]);
  assert.equal(profitAndLoss({ ...data, year: 2026 }).moneyIn, 119, 'all farms');
});

test('Liberian dollar entries are left out and counted, never mixed in as US dollars', () => {
  const r = profitAndLoss({ expenses: [E('2026-05-01', 10), E('2026-05-02', 5000, { currency: 'LRD' })], inputs: [{ id: 'i', farm_id: 'f1', purchase_date: '2026-05-03', cost: 900, currency: 'LRD' }] });
  assert.equal(r.moneyOut, 10);
  assert.equal(r.otherCurrencyEntries, 2);
});

test('nothing recorded: no data, and deleted records are ignored', () => {
  assert.equal(profitAndLoss().hasData, false);
  assert.equal(profitAndLoss({ expenses: [E('2026-05-01', 60, { deleted_at: 'x' })] }).hasData, false);
  const r = profitAndLoss({ expenses: [E('2026-05-01', 60)] });
  assert.equal(r.hasData, true);
  assert.equal(r.result, -60, 'costs with no harvest yet is a loss so far');
});
