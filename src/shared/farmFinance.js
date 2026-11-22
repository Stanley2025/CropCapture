'use strict';
/**
 * Profit and loss for a farm (or all of a farmer's farms), in US dollars and, separately, Liberian dollars.
 *
 *   Money in  = what the harvest was worth. The sale value the farmer entered is used; a harvest with no
 *               value entered is counted at the app's reference price (US dollars) and is reported
 *               separately as an estimate, so the farmer can see how much of the figure is a real entry.
 *   Money out = expenses + inputs + the cost entered on activities.
 *   Result    = money in - money out. Positive is a profit, negative is a loss.
 *
 * Amounts in the two currencies are never added together (there is no exchange rate): `usd` and `lrd`
 * each carry their own money in, money out and result.
 */
const { estimateHarvestValue, findCropById } = require('./farmRecords');
const { yearOf } = require('./farmYear');
const { currencyOf } = require('./money');

const live = (rows) => (rows || []).filter((r) => r && !r.deleted_at);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (n) => Math.round(n * 100) / 100;

const emptyTotals = () => ({ recordedIn: 0, estimatedIn: 0, moneyOut: 0 });
const finish = (t) => {
  const moneyIn = t.recordedIn + t.estimatedIn;
  const result = moneyIn - t.moneyOut;
  return {
    moneyIn: round2(moneyIn),
    recordedIn: round2(t.recordedIn),
    estimatedIn: round2(t.estimatedIn),
    moneyOut: round2(t.moneyOut),
    result: round2(result),
    isProfit: result >= 0,
    hasData: moneyIn > 0 || t.moneyOut > 0,
  };
};

function profitAndLoss({ harvests = [], expenses = [], inputs = [], activities = [], year = null, farmIds = null } = {}) {
  const inFarms = (r) => !farmIds || farmIds.includes(r.farm_id);
  const inYear = (dateText) => year === null || yearOf(dateText) === year;
  const totals = { USD: emptyTotals(), LRD: emptyTotals() };

  // Every amount that makes up the totals, so the screen can say which harvest, which farm and which cost
  const harvestLines = [];
  const costLines = [];

  let estimatedCount = 0;
  let harvestCount = 0;
  for (const h of live(harvests).filter(inFarms).filter((x) => inYear(x.harvest_date || x.created_at))) {
    harvestCount++;
    const entered = num(h.total_value);
    const crop = (h.crop && h.crop.name) || (findCropById(h.crop_id) || {}).name || null;
    const line = { id: h.id, farmId: h.farm_id, crop, reference: h.batch_reference || null, date: String(h.harvest_date || h.created_at || '').slice(0, 10), quantity: num(h.quantity), unit: h.unit || null };
    if (h.total_value !== null && h.total_value !== undefined && entered > 0) {
      totals[currencyOf(h)].recordedIn += entered;
      harvestLines.push({ ...line, amount: round2(entered), currency: currencyOf(h), estimated: false });
    } else {
      const est = estimateHarvestValue(h); // the reference price is in US dollars
      totals.USD.estimatedIn += est;
      estimatedCount++;
      harvestLines.push({ ...line, amount: round2(est), currency: 'USD', estimated: true });
    }
  }

  let costEntries = 0;
  for (const e of live(expenses).filter(inFarms).filter((x) => inYear(x.expense_date || x.created_at))) {
    totals[currencyOf(e)].moneyOut += num(e.amount);
    costEntries++;
    costLines.push({ id: e.id, farmId: e.farm_id, kind: 'expense', label: e.category || 'Expense', detail: e.description || null, date: String(e.expense_date || e.created_at || '').slice(0, 10), amount: round2(num(e.amount)), currency: currencyOf(e) });
  }
  for (const i of live(inputs).filter(inFarms).filter((x) => inYear(x.purchase_date || x.created_at))) {
    totals[currencyOf(i)].moneyOut += num(i.cost);
    costEntries++;
    costLines.push({ id: i.id, farmId: i.farm_id, kind: 'input', label: i.name || i.category || 'Input', detail: i.supplier || null, date: String(i.purchase_date || i.created_at || '').slice(0, 10), amount: round2(num(i.cost)), currency: currencyOf(i) });
  }
  for (const a of live(activities).filter(inFarms).filter((x) => inYear(x.activity_date))) {
    if (num(a.cost) > 0) {
      totals[currencyOf(a)].moneyOut += num(a.cost);
      costEntries++;
      costLines.push({ id: a.id, farmId: a.farm_id, kind: 'activity', label: a.activity_type || 'Activity', detail: null, date: String(a.activity_date || '').slice(0, 10), amount: round2(num(a.cost)), currency: currencyOf(a) });
    }
  }

  // Per farm: the same money in / money out / result, one row per farm and currency
  const farmMap = new Map();
  const farmRow = (farmId) => {
    if (!farmMap.has(farmId)) farmMap.set(farmId, { farmId, USD: emptyTotals(), LRD: emptyTotals() });
    return farmMap.get(farmId);
  };
  for (const l of harvestLines) farmRow(l.farmId)[l.currency][l.estimated ? 'estimatedIn' : 'recordedIn'] += l.amount;
  for (const l of costLines) farmRow(l.farmId)[l.currency].moneyOut += l.amount;
  const farms = [...farmMap.values()].map((f) => ({ farmId: f.farmId, usd: finish(f.USD), lrd: finish(f.LRD) }));

  const byDateDesc = (a, b) => String(b.date).localeCompare(String(a.date));
  const usd = finish(totals.USD);
  const lrd = finish(totals.LRD);
  return {
    // US dollars (kept at the top level for the screens that only show one figure)
    ...usd,
    hasData: harvestCount > 0 || costEntries > 0,
    estimatedCount,
    usd,
    lrd,
    hasLRD: lrd.hasData,
    farms,
    harvestLines: harvestLines.sort(byDateDesc),
    costLines: costLines.sort(byDateDesc),
  };
}

module.exports = { profitAndLoss };
