'use strict';
/**
 * A farm's record by year. Pure functions over the farmer's own activities and harvests, so they
 * run on the phone with no network and can be tested in node.
 *
 * Rules
 * - An activity or harvest belongs to the year of its OWN date. The year is read from the date text;
 *   there is no stored year column. (A season that runs over New Year therefore appears in both
 *   years, each entry under the year of its date.)
 * - A value the farmer never recorded is null, shown as "Not recorded". It is never turned into 0.
 *   A real 0 (for example a measured 0 mm, or a harvest of 0 kg) stays 0.
 */
const { toKg } = require('./seasonRecord');
const { PLANTING_ACTIVITIES, groupOf } = require('./activityTypes');
const { hasWeather, isRainy } = require('./activityWeather');

const PLANTING_SET = new Set(PLANTING_ACTIVITIES.map((t) => t.toLowerCase()));

/** The year a date text belongs to ("2026-12-31" -> 2026), or null when there is no usable date. */
function yearOf(dateText) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateText || '').trim());
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Number(m[1]);
}

const monthOf = (dateText) => Number(String(dateText).slice(5, 7));
const dayOf = (dateText) => String(dateText).slice(0, 10);

const live = (rows) => (rows || []).filter((r) => r && !r.deleted_at);
const activityYear = (a) => yearOf(a.activity_date);
const harvestYear = (h) => yearOf(h.harvest_date);

/** Years that have any activity or harvest, plus the current year, newest first. */
function yearsWithData({ activities = [], harvests = [], now = new Date() } = {}) {
  const years = new Set([now.getFullYear()]);
  for (const a of live(activities)) { const y = activityYear(a); if (y !== null) years.add(y); }
  for (const h of live(harvests)) { const y = harvestYear(h); if (y !== null) years.add(y); }
  return [...years].sort((a, b) => b - a);
}

const activitiesInYear = (activities, year) => live(activities).filter((a) => activityYear(a) === year);
const harvestsInYear = (harvests, year) => live(harvests).filter((h) => harvestYear(h) === year);

/** Total harvest in kg for the harvests given; null when nothing with a weight was recorded. */
function totalHarvestKg(harvests) {
  let total = 0;
  let counted = 0;
  for (const h of live(harvests)) {
    let kg = h.quantity_kg;
    if (kg === null || kg === undefined) {
      const conv = toKg({ quantity: h.quantity, unit: h.unit });
      kg = conv ? conv.kg : null;
    }
    if (kg !== null && kg !== undefined && Number.isFinite(Number(kg))) {
      total += Number(kg);
      counted++;
    }
  }
  return counted ? Math.round(total * 100) / 100 : null;
}

/** Earliest date of an activity that puts seed or plants in the ground; null when there is none. */
function firstPlantingDate(activities) {
  const dates = live(activities)
    .filter((a) => PLANTING_SET.has(String(a.activity_type || '').trim().toLowerCase()) && yearOf(a.activity_date) !== null)
    .map((a) => dayOf(a.activity_date))
    .sort();
  return dates.length ? dates[0] : null;
}

function lastHarvestDate(harvests) {
  const dates = live(harvests).filter((h) => harvestYear(h) !== null).map((h) => dayOf(h.harvest_date)).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

/** How many activities belong to a group (for example "Weeding"); null when there are none. */
function countInGroup(activities, group) {
  const n = live(activities).filter((a) => groupOf(a.activity_type) === group).length;
  return n || null;
}

/**
 * Rainy days recorded per month. A day is counted once however many activities it has. A month with no
 * weather recorded at all gives null (not recorded), not 0.
 * @returns {Array<{month:number, recordedDays:number, rainyDays:number|null}>}
 */
function rainyDaysByMonth(activities, year) {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, recorded: new Set(), rainy: new Set() }));
  for (const a of activitiesInYear(activities, year)) {
    if (!hasWeather(a)) continue;
    const m = months[monthOf(a.activity_date) - 1];
    const day = dayOf(a.activity_date);
    m.recorded.add(day);
    if (isRainy(a)) m.rainy.add(day);
  }
  return months.map((m) => ({ month: m.month, recordedDays: m.recorded.size, rainyDays: m.recorded.size ? m.rainy.size : null }));
}

/** Everything the year screen, the PDF and the plan table show, from the farmer's own records. */
function summarizeYear({ activities = [], harvests = [], year }) {
  const acts = activitiesInYear(activities, year);
  const harv = harvestsInYear(harvests, year);
  const months = rainyDaysByMonth(activities, year);
  const anyWeather = months.some((m) => m.rainyDays !== null);
  return {
    year,
    hasData: acts.length > 0 || harv.length > 0,
    harvestKg: totalHarvestKg(harv),
    activityCount: acts.length || null,
    firstPlantingDate: firstPlantingDate(acts),
    lastHarvestDate: lastHarvestDate(harv),
    rainyDaysTotal: anyWeather ? months.reduce((s, m) => s + (m.rainyDays || 0), 0) : null,
    weedingCount: countInGroup(acts, 'Weeding'),
    fertilizerCount: countInGroup(acts, 'Fertilizer application'),
    months,
  };
}

/** Text for a number, or the "not recorded" text when it was never recorded. 0 is shown as 0. */
function showMeasure(value, notRecorded, unit = '') {
  if (value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value))) return notRecorded;
  return unit ? `${value} ${unit}` : String(value);
}

const escapeHtml = (s) =>
  String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * The year record as a printable page. Only what the farmer recorded, plus the farm name, the year and
 * the date it was made. All wording comes in through `labels` so it can be translated.
 */
function buildYearPdfHtml({ farmName, year, createdOn, summary, activities, labels, notRecorded, weatherText }) {
  const L = labels;
  const tile = (label, value) => `<div class="tile"><div class="tl">${escapeHtml(label)}</div><div class="tv">${escapeHtml(value)}</div></div>`;
  const rainRows = summary.months
    .map((m) => `<tr><td>${escapeHtml(L.monthNames[m.month - 1])}</td><td>${escapeHtml(showMeasure(m.rainyDays, notRecorded))}</td></tr>`)
    .join('');
  const sorted = [...activities].sort((a, b) => String(a.activity_date).localeCompare(String(b.activity_date)));
  const timeline = sorted
    .map((a) => `<tr><td>${escapeHtml(dayOf(a.activity_date))}</td><td>${escapeHtml(a.activity_type)}</td><td>${escapeHtml(weatherText(a) || L.noWeather)}</td></tr>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(L.title)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#17301F;margin:28px}
  h1{color:#0F3D22;font-size:22px;margin:0 0 2px} h2{color:#0F3D22;font-size:15px;margin:22px 0 8px}
  .sub{color:#5B6F61;font-size:12px;margin-bottom:16px}
  .tiles{display:flex;flex-wrap:wrap;gap:8px} .tile{border:1px solid #E1ECDD;background:#F3F8F1;border-radius:8px;padding:10px 12px;width:46%}
  .tl{color:#5B6F61;font-size:11px} .tv{font-size:17px;font-weight:bold;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:12px} td,th{border-bottom:1px solid #E1ECDD;padding:6px 4px;text-align:left}
  th{color:#5B6F61;font-weight:normal} .foot{margin-top:24px;color:#5B6F61;font-size:11px}
</style></head><body>
<h1>${escapeHtml(farmName)}</h1>
<div class="sub">${escapeHtml(L.yearLine)} &middot; ${escapeHtml(L.createdOn)}</div>
<div class="tiles">
  ${tile(L.tileHarvest, showMeasure(summary.harvestKg, notRecorded, 'kg'))}
  ${tile(L.tileActivities, showMeasure(summary.activityCount, notRecorded))}
  ${tile(L.tileFirstPlanting, showMeasure(summary.firstPlantingDate, notRecorded))}
  ${tile(L.tileLastHarvest, showMeasure(summary.lastHarvestDate, notRecorded))}
</div>
<h2>${escapeHtml(L.rainyDays)}</h2>
<table><tr><th>${escapeHtml(L.month)}</th><th>${escapeHtml(L.rainyDaysShort)}</th></tr>${rainRows}</table>
<h2>${escapeHtml(L.timeline)}</h2>
<table><tr><th>${escapeHtml(L.date)}</th><th>${escapeHtml(L.activity)}</th><th>${escapeHtml(L.weather)}</th></tr>${timeline || `<tr><td colspan="3">${escapeHtml(L.noRecords)}</td></tr>`}</table>
<div class="foot">${escapeHtml(L.footer)}</div>
</body></html>`;
}

module.exports = {
  yearOf,
  yearsWithData,
  activitiesInYear,
  harvestsInYear,
  totalHarvestKg,
  firstPlantingDate,
  lastHarvestDate,
  countInGroup,
  rainyDaysByMonth,
  summarizeYear,
  showMeasure,
  buildYearPdfHtml,
};
