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

test('US dollars and Liberian dollars are totalled separately, never added together', () => {
  const r = profitAndLoss({
    harvests: [H('2026-09-01', 100, { total_value: 400 }), H('2026-09-02', 100, { total_value: 90000, currency: 'LRD' })],
    expenses: [E('2026-05-01', 10), E('2026-05-02', 5000, { currency: 'LRD' })],
    inputs: [{ id: 'i', farm_id: 'f1', purchase_date: '2026-05-03', cost: 900, currency: 'LRD' }],
    activities: [{ id: 'a', farm_id: 'f1', activity_date: '2026-06-02', cost: 2000, currency: 'LRD' }, { id: 'b', farm_id: 'f1', activity_date: '2026-06-03', cost: 5 }],
  });
  assert.deepEqual([r.usd.moneyIn, r.usd.moneyOut, r.usd.result], [400, 15, 385]);
  assert.deepEqual([r.lrd.moneyIn, r.lrd.moneyOut, r.lrd.result], [90000, 7900, 82100]);
  assert.equal(r.hasLRD, true);
  assert.equal(r.result, r.usd.result, 'the top-level figures are the US dollar ones');
  assert.equal(r.estimatedCount, 0);
});

test('a loss in Liberian dollars is a loss, whatever the US dollar side shows', () => {
  const r = profitAndLoss({ harvests: [H('2026-09-01', 100, { total_value: 100 })], expenses: [E('2026-05-02', 5000, { currency: 'LRD' })] });
  assert.equal(r.usd.isProfit, true);
  assert.deepEqual([r.lrd.moneyOut, r.lrd.result, r.lrd.isProfit], [5000, -5000, false]);
});

test('records saved before LRD existed have no currency and count as US dollars', () => {
  const r = profitAndLoss({ expenses: [{ id: 'e', farm_id: 'f1', expense_date: '2026-05-01', amount: 20 }], activities: [{ id: 'a', farm_id: 'f1', activity_date: '2026-05-02', cost: 5 }] });
  assert.equal(r.usd.moneyOut, 25);
  assert.equal(r.hasLRD, false);
});

test('a harvest value recorded in Liberian dollars is not counted as US dollars anywhere', () => {
  const { estimateHarvestRevenue, harvestRevenueLRD } = require('../src/shared/farmRecords');
  const harvests = [H('2026-09-01', 100, { total_value: 400 }), H('2026-09-02', 100, { total_value: 90000, currency: 'LRD' }), H('2026-09-03', 100, { total_value: 70000, currency: 'LRD', deleted_at: 'x' })];
  assert.equal(estimateHarvestRevenue(harvests), 400);
  assert.equal(harvestRevenueLRD(harvests), 90000);
});

test('money is shown with its currency', () => {
  const { formatMoney, currencyOf } = require('../src/shared/money');
  assert.equal(formatMoney(1250.5, 'USD'), '$1,250.5 USD');
  assert.equal(formatMoney(90000, 'LRD'), 'L$90,000 LRD');
  assert.equal(formatMoney(-30, 'USD'), '-$30 USD');
  assert.equal(formatMoney(undefined), '$0 USD');
  assert.equal(currencyOf({ currency: 'LRD' }), 'LRD');
  assert.equal(currencyOf({}), 'USD');
  assert.equal(currencyOf({ currency: 'EUR' }), 'USD');
});

test('nothing recorded: no data, and deleted records are ignored', () => {
  assert.equal(profitAndLoss().hasData, false);
  assert.equal(profitAndLoss({ expenses: [E('2026-05-01', 60, { deleted_at: 'x' })] }).hasData, false);
  const r = profitAndLoss({ expenses: [E('2026-05-01', 60)] });
  assert.equal(r.hasData, true);
  assert.equal(r.result, -60, 'costs with no harvest yet is a loss so far');
});

test('the breakdown says which harvest, which farm and which cost make up the totals', () => {
  const r = profitAndLoss({
    harvests: [
      H('2026-09-01', 500, { id: 'h-a', batch_reference: 'LR-RICE-1', crop: { name: 'Rice' }, total_value: 400 }),
      { ...H('2026-09-05', 1000, { id: 'h-b', batch_reference: 'LR-CASS-2', crop: { name: 'Cassava' } }), farm_id: 'f2' },
      H('2026-09-09', 10, { id: 'h-c', batch_reference: 'LR-RICE-3', crop: { name: 'Rice' }, total_value: 9000, currency: 'LRD' }),
    ],
    expenses: [E('2026-05-01', 60, { id: 'e1', category: 'Labour', description: 'weeding crew' })],
    inputs: [{ id: 'i1', farm_id: 'f2', purchase_date: '2026-04-20', cost: 35, currency: 'USD', name: 'NPK fertilizer', supplier: 'Kakata Agro' }],
    activities: [{ id: 'a1', farm_id: 'f1', activity_date: '2026-06-02', cost: 25, currency: 'USD', activity_type: 'Weeding' }],
  });
  assert.deepEqual(r.harvestLines.map((l) => [l.reference, l.farmId, l.crop, l.amount, l.currency, l.estimated]), [
    ['LR-RICE-3', 'f1', 'Rice', 9000, 'LRD', false],
    ['LR-CASS-2', 'f2', 'Cassava', 450, 'USD', true],
    ['LR-RICE-1', 'f1', 'Rice', 400, 'USD', false],
  ], 'newest first; the estimated one is marked');
  assert.deepEqual(r.costLines.map((l) => [l.kind, l.label, l.detail, l.farmId, l.amount]), [
    ['activity', 'Weeding', null, 'f1', 25],
    ['expense', 'Labour', 'weeding crew', 'f1', 60],
    ['input', 'NPK fertilizer', 'Kakata Agro', 'f2', 35],
  ]);
  const f1 = r.farms.find((f) => f.farmId === 'f1');
  const f2 = r.farms.find((f) => f.farmId === 'f2');
  assert.deepEqual([f1.usd.moneyIn, f1.usd.moneyOut, f1.usd.result], [400, 85, 315]);
  assert.deepEqual([f1.lrd.moneyIn, f1.lrd.hasData], [9000, true]);
  assert.deepEqual([f2.usd.moneyIn, f2.usd.moneyOut, f2.usd.result], [450, 35, 415]);
  // the farms add up to the totals
  assert.equal(f1.usd.moneyIn + f2.usd.moneyIn, r.usd.moneyIn);
  assert.equal(f1.usd.moneyOut + f2.usd.moneyOut, r.usd.moneyOut);
});
