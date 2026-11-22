'use strict';
/**
 * The two currencies a farmer can record amounts in: US dollars (USD) and Liberian dollars (LRD).
 * There is no exchange rate in the app, so the two are never added together: each screen shows USD and
 * LRD side by side, with its own total.
 */
const CURRENCIES = ['USD', 'LRD'];

/** The currency of a record. Records saved before LRD was offered have none, and are USD. */
const currencyOf = (record) => (record && record.currency === 'LRD' ? 'LRD' : 'USD');

const symbolOf = (currency) => (currency === 'LRD' ? 'L$' : '$');

/** "$1,250.50 USD" or "L$5,000 LRD" */
function formatMoney(amount, currency = 'USD') {
  const n = Number(amount);
  const text = Math.abs(Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${n < 0 ? '-' : ''}${symbolOf(currency)}${text} ${currency}`;
}

module.exports = { CURRENCIES, currencyOf, symbolOf, formatMoney };
