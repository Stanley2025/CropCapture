'use strict';
/**
 * Profit and loss for a farm (or all of a farmer's farms), in US dollars.
 *
 *   Money in  = what the harvest was worth. The sale value the farmer entered is used; a harvest with no
 *               value entered is counted at the app's reference price and is reported separately as an
 *               estimate, so the farmer can see how much of the figure is a real entry.
 *   Money out = expenses + inputs + the cost entered on activities.
 *   Result    = money in - money out. Positive is a profit, negative is a loss.
 *
 * Amounts in Liberian dollars are not mixed in (there is no exchange rate here); they are counted so the
 * screen can say some entries were left out.
 */
const { estimateHarvestValue } = require('./farmRecords');
const { yearOf } = require('./farmYear');

const live = (rows) => (rows || []).filter((r) => r && !r.deleted_at);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (n) => Math.round(n * 100) / 100;

function profitAndLoss({ harvests = [], expenses = [], inputs = [], activities = [], year = null, farmIds = null } = {}) {
  const inFarms = (r) => !farmIds || farmIds.includes(r.farm_id);
  const inYear = (dateText) => year === null || yearOf(dateText) === year;

  let recordedIn = 0;
  let estimatedIn = 0;
  let estimatedCount = 0;
  let harvestCount = 0;
  for (const h of live(harvests).filter(inFarms).filter((x) => inYear(x.harvest_date || x.created_at))) {
    harvestCount++;
    const entered = num(h.total_value);
    if (h.total_value !== null && h.total_value !== undefined && entered > 0) recordedIn += entered;
    else {
      estimatedIn += estimateHarvestValue(h);
      estimatedCount++;
    }
  }

  let moneyOut = 0;
  let otherCurrency = 0;
  let costEntries = 0;
  for (const e of live(expenses).filter(inFarms).filter((x) => inYear(x.expense_date || x.created_at))) {
    if ((e.currency || 'USD') !== 'USD') { otherCurrency++; continue; }
    moneyOut += num(e.amount);
    costEntries++;
  }
  for (const i of live(inputs).filter(inFarms).filter((x) => inYear(x.purchase_date || x.created_at))) {
    if ((i.currency || 'USD') !== 'USD') { otherCurrency++; continue; }
    moneyOut += num(i.cost);
    costEntries++;
  }
  for (const a of live(activities).filter(inFarms).filter((x) => inYear(x.activity_date))) {
    if (num(a.cost) > 0) { moneyOut += num(a.cost); costEntries++; }
  }

  const moneyIn = recordedIn + estimatedIn;
  const result = moneyIn - moneyOut;
  return {
    hasData: harvestCount > 0 || costEntries > 0,
    moneyIn: round2(moneyIn),
    recordedIn: round2(recordedIn),
    estimatedIn: round2(estimatedIn),
    estimatedCount,
    moneyOut: round2(moneyOut),
    result: round2(result),
    isProfit: result >= 0,
    otherCurrencyEntries: otherCurrency,
  };
}

module.exports = { profitAndLoss };
