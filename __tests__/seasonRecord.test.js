const test = require('node:test');
const assert = require('node:assert/strict');

const R = require('../src/shared/seasonRecord');

const NOW = new Date('2026-09-30T10:00:00Z');
const SEASON = 's1';

// ---------------------------------------------------------------------------
// Local units
// ---------------------------------------------------------------------------
test('local units convert to kg and say when the weight is only an estimate', () => {
  assert.deepEqual(R.toKg({ quantity: 3, unit: 'bag' }), { kg: 150, kgPerUnit: 50, unit: 'bag', estimated: false });
  assert.equal(R.toKg({ quantity: 2, unit: '50kg bags' }).kg, 100, 'existing harvest unit wording');
  assert.equal(R.toKg({ quantity: 1.5, unit: 'tonnes' }).kg, 1500);
  assert.equal(R.toKg({ quantity: 12, unit: 'kg' }).kg, 12);
  const cups = R.toKg({ quantity: 8, unit: 'Cups' });
  assert.equal(cups.kg, 8 * R.KG_PER_UNIT.cup);
  assert.equal(cups.estimated, true, 'cups and tins are placeholders for agronomists to confirm');
  assert.equal(R.toKg({ quantity: 2, unit: 'tin' }).estimated, true);
  assert.equal(R.toKg({ quantity: 2, unit: 'bag' }).estimated, false);
  assert.equal(R.toKg({ quantity: 5, unit: 'bunches' }), null, 'no weight for bunches');
  assert.equal(R.toKg({ quantity: -1, unit: 'kg' }), null);
  assert.equal(R.toKg({ quantity: 'abc', unit: 'kg' }), null);
  assert.equal(R.toKg({ quantity: 1, unit: 'kg', cropCode: 'UNKNOWN' }).kg, 1);
  assert.ok(Object.isFrozen(R.KG_PER_UNIT) && Object.isFrozen(R.KG_PER_UNIT_BY_CROP_CODE));
});

// ---------------------------------------------------------------------------
// Season details: every field optional, one tap = one patch
// ---------------------------------------------------------------------------
const patch = (existing, p, extra = {}) => R.mergeSeasonDetails(existing, p, { seasonId: SEASON, now: NOW, ...extra });

test('details: one tap saves one field and keeps the rest', () => {
  let d = patch(null, { field_type: 'lowland_swamp' });
  assert.equal(d.season_id, SEASON);
  assert.equal(d.field_type, 'lowland_swamp');
  assert.ok(d.id);
  d = patch(d, { land_preparation: ['brushed', 'felled', 'burned', 'burned'] });
  d = patch(d, { seed_source: 'saved', intercropped: false, fallow_months: 24, previous_crop_name: 'Cassava', variety_label: 'Saved seed' });
  assert.equal(d.field_type, 'lowland_swamp');
  assert.deepEqual(d.land_preparation, ['brushed', 'felled', 'burned'], 'no duplicates');
  assert.equal(d.seed_source, 'saved');
  assert.equal(d.intercropped, false);
  assert.equal(d.fallow_months, 24);
  assert.equal(d.updated_at, NOW.toISOString());
  assert.equal(patch(d, { field_type: null }).field_type, null, 'a tap can be cleared');
  assert.equal(patch(d, { unknown_field: 'x' }).unknown_field, undefined, 'unknown fields are ignored');
});

test('details: seed quantity in local units is stored with its kg conversion', () => {
  let d = patch(null, { seed_qty_local: 3, seed_unit_local: 'tin' });
  assert.deepEqual([d.seed_qty_local, d.seed_unit_local, d.seed_kg_per_unit, d.seed_kg], [3, 'tin', R.KG_PER_UNIT.tin, 3 * R.KG_PER_UNIT.tin]);
  d = patch(d, { seed_unit_local: 'bag' }); // change only the unit
  assert.equal(d.seed_kg, 150);
  d = patch(d, { seed_qty_local: 2 }); // change only the quantity
  assert.equal(d.seed_kg, 100);
  const cleared = patch(d, { seed_qty_local: null });
  assert.deepEqual([cleared.seed_qty_local, cleared.seed_kg, cleared.seed_kg_per_unit], [null, null, null]);
  assert.throws(() => patch(null, { seed_qty_local: 3, seed_unit_local: 'bunches' }), /seed unit/);
  assert.throws(() => patch(null, { seed_qty_local: 0, seed_unit_local: 'kg' }), /seed quantity/);
});

test('details: wrong values are refused, not saved', () => {
  for (const bad of [{ field_type: 'hilltop' }, { seed_source: 'stolen' }, { storage_method: 'moon' }, { reflection_choice: 'nothing' },
    { land_preparation: ['burned', 'bulldozed'] }, { fallow_months: -1 }, { storage_months: 0 }, { storage_loss_kg: -3 }, { home_price_per_kg: 'abc' },
    { home_price_currency: 'EUR' }]) {
    assert.throws(() => patch(null, bad), /Invalid/, JSON.stringify(bad));
  }
  const d = patch(null, { storage_method: 'bags', storage_months: 3, storage_loss_kg: 12.5, home_price_per_kg: 0.4, home_price_currency: 'USD', reflection_choice: 'weed_more', reflection_audio_path: 'a/b.m4a' });
  assert.deepEqual([d.storage_method, d.storage_months, d.storage_loss_kg, d.home_price_per_kg, d.reflection_choice], ['bags', 3, 12.5, 0.4, 'weed_more']);
});

// ---------------------------------------------------------------------------
// List entries
// ---------------------------------------------------------------------------
test('labour: family, hired or kuu, with days, cost and currency stored per record', () => {
  const l = R.buildLaborEntry({ seasonId: SEASON, laborType: 'communal', days: 4, cost: 25, currency: 'LRD', now: NOW });
  assert.deepEqual([l.labor_type, l.days, l.cost, l.currency], ['communal', 4, 25, 'LRD']);
  const family = R.buildLaborEntry({ seasonId: SEASON, laborType: 'family', days: 10 });
  assert.equal(family.cost, 0, 'family labour has no cash cost by default');
  assert.equal(family.currency, R.DEFAULT_CURRENCY);
  assert.throws(() => R.buildLaborEntry({ seasonId: SEASON, laborType: 'slave', days: 1 }), /labour type/);
  assert.throws(() => R.buildLaborEntry({ seasonId: SEASON, laborType: 'hired', days: 0 }), /days/);
  assert.throws(() => R.buildLaborEntry({ seasonId: SEASON, laborType: 'hired', days: 2, cost: -5 }), /cost/);
  assert.throws(() => R.buildLaborEntry({ seasonId: SEASON, laborType: 'hired', days: 2, currency: 'EUR' }), /currency/);
});

test('problems: dated, with small / medium / big severity; defaults to today and small', () => {
  const p = R.buildProblem({ seasonId: SEASON, problemType: 'disease', detail: 'Cassava mosaic', now: NOW });
  assert.deepEqual([p.problem_type, p.severity, p.problem_date, p.detail], ['disease', 'small', '2026-09-30', 'Cassava mosaic']);
  assert.equal(R.buildProblem({ seasonId: SEASON, problemType: 'flood', severity: 'big', date: '2026-07-02' }).problem_date, '2026-07-02');
  for (const t of ['birds', 'rats', 'insects', 'disease', 'weeds', 'flood', 'drought', 'windstorm', 'fire', 'animals', 'theft']) {
    assert.equal(R.buildProblem({ seasonId: SEASON, problemType: t }).problem_type, t);
  }
  assert.throws(() => R.buildProblem({ seasonId: SEASON, problemType: 'aliens' }), /problem/);
  assert.throws(() => R.buildProblem({ seasonId: SEASON, problemType: 'fire', severity: 'huge' }), /severity/);
  assert.throws(() => R.buildProblem({ seasonId: SEASON, problemType: 'fire', date: '02/07/2026' }), /date/);
  assert.deepEqual(R.DISEASE_SUGGESTIONS.CASS, ['Cassava mosaic']);
  assert.deepEqual(R.DISEASE_SUGGESTIONS.COCO, ['Black pod']);
});

test('where the harvest went: sold / eaten / seed / lost, local units converted to kg', () => {
  const sold = R.buildDisposal({
    seasonId: SEASON, destination: 'sold', quantity: 3, unit: 'bag',
    sale: { pricePerUnit: 40, currency: 'USD', month: '2026-08', buyerMarket: 'Ganta market', transportCost: 10 }, now: NOW,
  });
  assert.deepEqual([sold.qty_local, sold.unit_local, sold.kg_per_unit, sold.qty_kg], [3, 'bag', 50, 150]);
  assert.deepEqual([sold.price_per_unit, sold.sale_currency, sold.sold_month, sold.buyer_market, sold.transport_cost], [40, 'USD', '2026-08', 'Ganta market', 10]);

  const lost = R.buildDisposal({ seasonId: SEASON, destination: 'lost', quantity: 4, unit: 'cup', lossReason: 'rats', sale: { pricePerUnit: 99 } });
  assert.equal(lost.loss_reason, 'rats');
  assert.equal(lost.price_per_unit, null, 'sale details only apply to sold harvest');
  const eaten = R.buildDisposal({ seasonId: SEASON, destination: 'eaten', quantity: 1, unit: 'bag', lossReason: 'rot' });
  assert.equal(eaten.loss_reason, null, 'a loss reason only applies to lost harvest');
  assert.equal(R.buildDisposal({ seasonId: SEASON, destination: 'lost', quantity: 1, unit: 'kg' }).loss_reason, null, 'reason is optional');

  const bunches = R.buildDisposal({ seasonId: SEASON, destination: 'eaten', quantity: 6, unit: 'bunches' });
  assert.equal(bunches.qty_kg, null);
  assert.equal(bunches.unit_local, 'bunches');

  const defaults = R.buildDisposal({ seasonId: SEASON, destination: 'sold', quantity: 1, unit: 'kg', now: NOW });
  assert.deepEqual([defaults.sold_month, defaults.sale_currency, defaults.transport_cost, defaults.price_per_unit], ['2026-09', 'USD', 0, null]);

  assert.throws(() => R.buildDisposal({ seasonId: SEASON, destination: 'gifted', quantity: 1, unit: 'kg' }), /destination/);
  assert.throws(() => R.buildDisposal({ seasonId: SEASON, destination: 'sold', quantity: 0, unit: 'kg' }), /quantity/);
  assert.throws(() => R.buildDisposal({ seasonId: SEASON, destination: 'lost', quantity: 1, unit: 'kg', lossReason: 'witchcraft' }), /loss reason/);
  assert.throws(() => R.buildDisposal({ seasonId: SEASON, destination: 'sold', quantity: 1, unit: 'kg', sale: { month: '2026-13' } }), /month/);
  assert.throws(() => R.buildDisposal({ seasonId: SEASON, destination: 'sold', quantity: 1, unit: 'kg', sale: { pricePerUnit: -2 } }), /price/);
});

test('harvest use totals add up and flag over- and under-accounting', () => {
  const d = (destination, quantity, unit, extra = {}) => R.buildDisposal({ seasonId: SEASON, destination, quantity, unit, ...extra });
  const rows = [d('sold', 2, 'bag'), d('eaten', 30, 'kg'), d('seed', 10, 'kg'), d('lost', 8, 'kg', { lossReason: 'rot' }), d('lost', 4, 'kg', { lossReason: 'rats' }), d('lost', 4, 'kg')];
  const u = R.summarizeHarvestUse(rows, 200);
  assert.deepEqual(u.kg, { sold: 100, eaten: 30, seed: 10, lost: 16 });
  assert.deepEqual(u.lostBy, { rot: 8, rats: 4, other: 4 });
  assert.equal(u.accounted, 156);
  assert.equal(u.unaccounted, 44);
  assert.equal(u.over, false);
  assert.equal(R.summarizeHarvestUse(rows, 100).over, true, 'more recorded than harvested');
  assert.equal(R.summarizeHarvestUse(rows, 100).unaccounted, 0);
  assert.equal(R.summarizeHarvestUse(rows).unaccounted, null);
  assert.equal(R.summarizeHarvestUse([d('eaten', 3, 'bunches')], 10).withoutKg, 1);
});

// ---------------------------------------------------------------------------
// Costs that belong to a season
// ---------------------------------------------------------------------------
const FARM = 'farm1';
const mkSeason = (id, planting, extra = {}) => ({ id, farm_id: FARM, planting_date: planting, status: 'active', ...extra });

test('costs: linked records always count; unlinked ones count only when the season is alone on the farm', () => {
  const season = mkSeason('s1', '2026-05-01');
  const expenses = [
    { id: 'e1', farm_id: FARM, season_id: 's1', amount: 10, expense_date: '2025-01-01' }, // linked: counts whatever the date
    { id: 'e2', farm_id: FARM, season_id: null, amount: 20, expense_date: '2026-06-01' }, // inside the season
    { id: 'e3', farm_id: FARM, season_id: null, amount: 30, expense_date: '2026-04-01' }, // before planting
    { id: 'e4', farm_id: 'other', season_id: null, amount: 40, expense_date: '2026-06-01' }, // other farm
    { id: 'e5', farm_id: FARM, season_id: 's9', amount: 50, expense_date: '2026-06-01' }, // another season's
    { id: 'e6', farm_id: FARM, season_id: null, amount: 60, expense_date: '2026-06-02', deleted_at: 'x' },
  ];
  const alone = R.attributeSeasonCosts({ season, seasonsOnFarm: [season], expenses, now: NOW });
  assert.deepEqual(alone.expenses.map((e) => e.id), ['e1', 'e2']);
  assert.equal(alone.sharedCount, 0);

  const other = mkSeason('s2', '2026-06-01'); // overlaps, so unlinked costs cannot be assigned
  const busy = R.attributeSeasonCosts({ season, seasonsOnFarm: [season, other], expenses, now: NOW });
  assert.deepEqual(busy.expenses.map((e) => e.id), ['e1']);
  assert.equal(busy.sharedCount, 1, 'e2 is reported as shared, not guessed');

  const earlier = mkSeason('s3', '2025-01-01');
  const finished = R.attributeSeasonCosts({ season, seasonsOnFarm: [season, earlier], harvests: [{ season_id: 's3', harvest_date: '2025-06-01' }], expenses, now: NOW });
  assert.deepEqual(finished.expenses.map((e) => e.id), ['e1', 'e2'], 'a finished earlier season does not overlap');
  assert.equal(R.attributeSeasonCosts({ season, seasonsOnFarm: [season, { ...other, status: 'cancelled' }], expenses, now: NOW }).expenses.length, 2, 'cancelled seasons are ignored');
});

test('costs: inputs and activities follow the same rule with their own date fields', () => {
  const season = mkSeason('s1', '2026-05-01');
  const r = R.attributeSeasonCosts({
    season, seasonsOnFarm: [season], now: NOW,
    inputs: [{ id: 'i1', farm_id: FARM, purchase_date: '2026-05-03', cost: 5 }, { id: 'i2', farm_id: FARM, purchase_date: '2026-01-03', cost: 5 }],
    activities: [{ id: 'a1', farm_id: FARM, activity_date: '2026-06-03', cost: 7 }, { id: 'a2', farm_id: FARM, season_id: 's1', activity_date: '2026-06-04', cost: 1 }],
  });
  assert.deepEqual(r.inputs.map((x) => x.id), ['i1']);
  assert.deepEqual(r.activities.map((x) => x.id), ['a1', 'a2']);
});

// ---------------------------------------------------------------------------
// Profit: cash profit and home food as two separate lines
// ---------------------------------------------------------------------------
function worked() {
  const d = (destination, quantity, unit, extra = {}) => R.buildDisposal({ seasonId: SEASON, destination, quantity, unit, now: NOW, ...extra });
  return {
    disposals: [
      d('sold', 3, 'bag', { sale: { pricePerUnit: 40, currency: 'USD', transportCost: 10 } }), // 120 USD, transport 10
      d('sold', 20, 'cup', { sale: { pricePerUnit: 5, currency: 'LRD', transportCost: 50 } }), // 100 LRD, transport 50
      d('eaten', 2, 'bag'), // 100 kg kept for home
      d('seed', 10, 'kg'),
      d('lost', 5, 'kg', { lossReason: 'wet' }),
    ],
    labor: [
      R.buildLaborEntry({ seasonId: SEASON, laborType: 'family', days: 5 }), // no cash
      R.buildLaborEntry({ seasonId: SEASON, laborType: 'hired', days: 3, cost: 15, currency: 'USD' }),
      R.buildLaborEntry({ seasonId: SEASON, laborType: 'communal', days: 1, cost: 500, currency: 'LRD' }),
    ],
    costs: {
      expenses: [{ amount: 20, currency: 'USD' }],
      inputs: [{ cost: 30, currency: 'USD' }],
      activities: [{ cost: 5 }],
    },
  };
}

test('profit: cash profit per currency, never mixing LRD and USD', () => {
  const { currencies } = R.summarizeSeasonProfit({ ...worked(), details: null });
  const usd = currencies.find((c) => c.currency === 'USD');
  const lrd = currencies.find((c) => c.currency === 'LRD');
  // USD: revenue 3 x 40 = 120; costs transport 10 + labour 15 + expense 20 + input 30 + activity 5 = 80
  assert.deepEqual(usd, { currency: 'USD', revenue: 120, transportCost: 10, laborCost: 15, expenseCost: 20, inputCost: 30, activityCost: 5, cashCosts: 80, cashProfit: 40 });
  // LRD: revenue 20 x 5 = 100; costs transport 50 + labour 500 = 550
  assert.deepEqual(lrd, { currency: 'LRD', revenue: 100, transportCost: 50, laborCost: 500, expenseCost: 0, inputCost: 0, activityCost: 0, cashCosts: 550, cashProfit: -450 });
  assert.equal(currencies.length, 2);
});

test('profit: value of food kept for home is a separate line and never part of cash profit', () => {
  const w = worked();
  const without = R.summarizeSeasonProfit({ ...w, details: null });
  assert.deepEqual(without.homeFood, { kg: 100, pricePerKg: null, currency: 'USD', value: null, needsPrice: true });

  const details = R.mergeSeasonDetails(null, { home_price_per_kg: 0.5, home_price_currency: 'USD' }, { seasonId: SEASON, now: NOW });
  const withPrice = R.summarizeSeasonProfit({ ...w, details });
  assert.deepEqual(withPrice.homeFood, { kg: 100, pricePerKg: 0.5, currency: 'USD', value: 50, needsPrice: false });
  assert.deepEqual(withPrice.currencies, without.currencies, 'cash profit is identical with and without the home-food price');
  assert.equal(withPrice.currencies.find((c) => c.currency === 'USD').cashProfit, 40);

  const nothingEaten = R.summarizeSeasonProfit({ disposals: [], details });
  assert.deepEqual(nothingEaten.homeFood, { kg: 0, pricePerKg: 0.5, currency: 'USD', value: 0, needsPrice: false });
  assert.equal(R.summarizeSeasonProfit({ disposals: [] }).homeFood.needsPrice, false, 'nothing eaten, so no price needed');
  assert.deepEqual(R.summarizeSeasonProfit({}).currencies, []);
});

test('profit: a sale with no price recorded adds no revenue and does not break the totals', () => {
  const sold = R.buildDisposal({ seasonId: SEASON, destination: 'sold', quantity: 2, unit: 'bag', sale: { transportCost: 4 } });
  const { currencies } = R.summarizeSeasonProfit({ disposals: [sold] });
  assert.deepEqual(currencies.map((c) => [c.currency, c.revenue, c.cashCosts, c.cashProfit]), [['USD', 0, 4, -4]]);
});

// ---------------------------------------------------------------------------
// One-per-season rows and the database-column fallback
// ---------------------------------------------------------------------------
test('one-per-season rows get the same id on every phone', () => {
  const season = '3f2b8c1e-9d4a-4b6f-8a7e-1c2d3e4f5a6b';
  const a = R.stableRowId('details', season);
  assert.equal(a, R.stableRowId('details', season), 'deterministic');
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.notEqual(a, season);
  assert.notEqual(R.stableRowId('details', season), R.stableRowId('weather', season));
  assert.notEqual(R.stableRowId('details', season), R.stableRowId('details', '4f2b8c1e-9d4a-4b6f-8a7e-1c2d3e4f5a6b'));
  const d1 = R.mergeSeasonDetails(null, { field_type: 'upland' }, { seasonId: season, now: NOW });
  const d2 = R.mergeSeasonDetails(null, { seed_source: 'saved' }, { seasonId: season, now: NOW });
  assert.equal(d1.id, d2.id, 'two phones creating details for one season produce one row');
  assert.equal(d1.id, a);
  assert.match(R.stableRowId('details', 'not-a-uuid'), /^[0-9a-f-]{36}$/, 'falls back to a random uuid');
});

const { upsertDroppingMissingColumns } = require('../src/shared/columnFallback');
const fakeDb = (missing, fkBroken = []) => {
  const calls = [];
  return {
    calls,
    upsert: async (rows) => {
      calls.push(rows);
      const bad = Object.keys(rows[0]).find((k) => missing.includes(k) || fkBroken.includes(k));
      if (!bad) return { error: null };
      if (fkBroken.includes(bad)) return { error: { message: `insert or update on table "farms" violates foreign key constraint "farms_${bad}_fkey"` } };
      return { error: { message: `Could not find the '${bad}' column of 'harvest_batches' in the schema cache` } };
    },
  };
};

test('upsert drops columns the database does not have, and nothing else', async () => {
  const db = fakeDb(['quantity_kg', 'kg_per_unit']);
  const skip = new Set();
  const r = await upsertDroppingMissingColumns(db.upsert, [{ id: '1', quantity: 5, quantity_kg: 5, kg_per_unit: 1 }], skip);
  assert.equal(r.error, null);
  assert.deepEqual(r.rows, [{ id: '1', quantity: 5 }]);
  assert.deepEqual(r.dropped.sort(), ['kg_per_unit', 'quantity_kg']);
  assert.equal(db.calls.length, 3);
  // the skip set is remembered: the next save succeeds first time
  const again = await upsertDroppingMissingColumns(db.upsert, [{ id: '2', quantity: 6, quantity_kg: 6 }], skip);
  assert.equal(db.calls.length, 4);
  assert.deepEqual(again.rows, [{ id: '2', quantity: 6 }]);
});

test('upsert never drops a required column, and passes real errors through', async () => {
  const fk = fakeDb([], ['farmer_id']);
  const r = await upsertDroppingMissingColumns(fk.upsert, [{ id: '1', farmer_id: 'x' }]);
  assert.match(r.error.message, /violates foreign key/, 'a required reference is an error, not something to drop');
  assert.equal(fk.calls.length, 1);

  const optional = fakeDb([], ['county_id']);
  const ok = await upsertDroppingMissingColumns(optional.upsert, [{ id: '1', county_id: 'c', name: 'n' }]);
  assert.equal(ok.error, null);
  assert.deepEqual(ok.rows, [{ id: '1', name: 'n' }], 'an optional reference may be dropped');

  const denied = await upsertDroppingMissingColumns(async () => ({ error: { message: 'permission denied for table farms' } }), [{ id: '1' }]);
  assert.match(denied.error.message, /permission denied/);
  const unknownColumn = await upsertDroppingMissingColumns(async () => ({ error: { message: "Could not find the 'zzz' column of 't'" } }), [{ id: '1' }]);
  assert.ok(unknownColumn.error, 'a column that is not in the row cannot be the cause: report it');
});
