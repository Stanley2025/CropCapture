'use strict';
/**
 * The farmer's plan for a coming year: three things they decide themselves (crop, planting date, what
 * to change from last year). Nothing here suggests a value. One plan per farm per year.
 */
const { generateUUID } = require('./farmRecords');
const { summarizeYear } = require('./farmYear');

/** XOR mask (32 hex digits). XOR is one-to-one, so different farms never share a plan id. */
const PLAN_ID_MASK = 'b1a40c1fb1a40c1fb1a40c1fb1a40000';
const MAX_CROP_LENGTH = 80;
const MAX_NOTE_LENGTH = 500;

/** The year a plan made today is for: the current year plus one. */
const planYearFor = (now = new Date()) => now.getFullYear() + 1;

/**
 * The plan's id, made on the phone from the farm and the year. Two phones that both save a plan for the
 * same farm and year get the same id, so they update one row instead of creating two.
 */
function planIdFor(farmId, year) {
  const hex = String(farmId).toLowerCase().replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/.test(hex) || !Number.isInteger(year) || year < 0 || year > 0xffff) return generateUUID();
  const mask = PLAN_ID_MASK.split('');
  const yearHex = year.toString(16).padStart(4, '0');
  for (let i = 0; i < 4; i++) mask[28 + i] = yearHex[i];
  let out = '';
  for (let i = 0; i < 32; i++) out += (parseInt(hex[i], 16) ^ parseInt(mask[i], 16)).toString(16);
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}-${out.slice(16, 20)}-${out.slice(20)}`;
}

const isoDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));
const clean = (v, max) => {
  const text = String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
  return text === '' ? null : text;
};

/**
 * Build the plan record to save. Saving again for the same farm and year updates the same plan
 * (same id, original created_at kept). Every field is optional: what the farmer leaves empty stays empty.
 */
function buildPlan({ farmId, year, crop, plantingDate, changeNote, existing = null, now = new Date() }) {
  if (!farmId) throw new Error('Farm is required');
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Invalid year');
  const date = plantingDate ? String(plantingDate).slice(0, 10) : null;
  if (date !== null && !isoDate(date)) throw new Error('Invalid planting date');
  const ts = now.toISOString();
  return {
    id: planIdFor(farmId, year),
    farm_id: farmId,
    plan_year: year,
    crop: clean(crop, MAX_CROP_LENGTH),
    planting_date: date,
    change_note: clean(changeNote, MAX_NOTE_LENGTH),
    created_at: existing && existing.created_at ? existing.created_at : ts,
    updated_at: ts,
    deleted_at: null, // saving a plan that was removed before brings it back
  };
}

/**
 * The comparison table for the planning screen: the same measures for the two years before the plan.
 * A measure with no data is null (shown as "Not recorded").
 * @returns {{ years: number[], rows: Array<{key: string, values: Array<number|string|null>}> }}
 */
function comparePreviousYears({ activities = [], harvests = [], planYear }) {
  const years = [planYear - 2, planYear - 1];
  const s = years.map((year) => summarizeYear({ activities, harvests, year }));
  const row = (key, pick) => ({ key, values: s.map(pick) });
  return {
    years,
    rows: [
      row('harvest', (x) => x.harvestKg),
      row('planting', (x) => x.firstPlantingDate),
      row('rainyDays', (x) => x.rainyDaysTotal),
      row('weeding', (x) => x.weedingCount),
      row('fertilizer', (x) => x.fertilizerCount),
    ],
  };
}

module.exports = { planYearFor, planIdFor, buildPlan, comparePreviousYears, MAX_CROP_LENGTH, MAX_NOTE_LENGTH };
