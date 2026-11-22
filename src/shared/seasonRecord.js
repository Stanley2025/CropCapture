'use strict';
/**
 * Season record: the gaps in what the app knows about a season.
 *
 * Everything here is optional and has a sensible default. Only information the existing
 * tables lack is added (crop, variety, area, seed quantity, harvest date/quantity, labour
 * count and costs already exist in farm_seasons / farm_activities / harvest_batches /
 * expenses / input_records).
 *
 * Pure functions (no React, no storage) so they run in the app and in node:test.
 */
const { generateUUID } = require('./farmRecords');

// ---------------------------------------------------------------------------
// Option lists (value is stored; label is what the farmer sees)
// ---------------------------------------------------------------------------
const opt = (value, label) => ({ value, label });

const FIELD_TYPES = [opt('upland', 'Upland'), opt('lowland_swamp', 'Lowland / swamp')];
const LAND_PREPARATION = [opt('brushed', 'Brushed'), opt('felled', 'Felled'), opt('burned', 'Burned'), opt('ploughed', 'Ploughed')];
/** Fallow length in months; 0 = the field was cropped last season. */
const FALLOW_LENGTHS = [opt(0, 'No fallow'), opt(12, '1 year'), opt(24, '2 years'), opt(36, '3 years'), opt(60, '5+ years')];
const SEED_SOURCES = [
  opt('saved', 'Saved seed'),
  opt('bought', 'Bought'),
  opt('shared', 'Family / neighbour'),
  opt('project', 'Project / NGO'),
];
const LABOR_TYPES = [opt('family', 'Family'), opt('hired', 'Hired'), opt('communal', 'Kuu (communal group)')];
const PROBLEM_TYPES = [
  opt('birds', 'Birds'), opt('rats', 'Rats'), opt('insects', 'Insects'), opt('disease', 'Disease'), opt('weeds', 'Weeds'),
  opt('flood', 'Flood'), opt('drought', 'Drought'), opt('windstorm', 'Windstorm'), opt('fire', 'Fire'),
  opt('animals', 'Animals'), opt('theft', 'Theft'),
];
/** Disease names the farmer can tap, by crop code. */
const DISEASE_SUGGESTIONS = { CASS: ['Cassava mosaic'], COCO: ['Black pod'], RICE: ['Rice blast'] };
const SEVERITIES = [opt('small', 'Small'), opt('medium', 'Medium'), opt('big', 'Big')];
const DESTINATIONS = [opt('sold', 'Sold'), opt('eaten', 'Eaten at home'), opt('seed', 'Kept as seed'), opt('lost', 'Lost')];
const LOSS_REASONS = [opt('rot', 'Rot'), opt('rats', 'Rats'), opt('wet', 'Got wet'), opt('other', 'Other')];
const STORAGE_METHODS = [
  opt('bags', 'Bags'), opt('barn', 'Barn / store room'), opt('drum', 'Drum / container'), opt('open', 'Open / on the floor'), opt('other', 'Other'),
];
const STORAGE_MONTHS = [1, 2, 3, 6, 12];
const REFLECTION_CHOICES = [
  opt('plant_earlier', 'Plant earlier'), opt('weed_more', 'Weed more'), opt('more_seed', 'Use more seed'),
  opt('change_variety', 'Change variety'), opt('other', 'Other'),
];
const CURRENCIES = ['LRD', 'USD'];
/** Default currency for new records; one tap switches it (stored per record). */
const DEFAULT_CURRENCY = 'USD';

const values = (list) => list.map((o) => o.value);
const labelOf = (list, value) => {
  const o = list.find((x) => x.value === value);
  return o ? o.label : value;
};

// ---------------------------------------------------------------------------
// Local units -> kg
// ---------------------------------------------------------------------------
/**
 * Kilograms in one local unit.
 *
 * ESTIMATES: cups and tins vary from market to market and by crop, so these defaults are
 * placeholders for local agronomists to adjust (here, or per crop in KG_PER_UNIT_BY_CROP_CODE).
 * Each saved record stores the quantity as the farmer said it, the factor used and the kg,
 * so changing a factor later never silently rewrites what a farmer recorded.
 */
const KG_PER_UNIT = Object.freeze({ kg: 1, tonne: 1000, bag: 50, cup: 0.25, tin: 1 });
/** e.g. { CASS: { bag: 60 } } for crops sold in bags of a different weight. */
const KG_PER_UNIT_BY_CROP_CODE = Object.freeze({});
/** Units whose weight is a rough local estimate rather than a standard. */
const ESTIMATED_UNITS = Object.freeze(['cup', 'tin']);

/** Crop varieties offered when a season is created (by crop code); also shown on the season record. */
const VARIETIES_BY_CROP_CODE = Object.freeze({
  COFF: ["Liberica Indigenous", "Robusta", "Arabica"],
  COCO: ["Forastero Hybrid", "Trinitario Elite"],
  RICE: ["Suakoko 8", "LAC 23", "Nerica L-19"],
  CASS: ["CARICASS 1", "TMS 30572", "Bassa Girl"],
  PALM: ["Tenera Hybrid", "Dura"],
  MAIZ: ["DMR-ESR-Y", "Western Yellow"],
  PEPP: ["Scotch Bonnet", "Habanero", "Local Birdseye"],
  PLAN: ["Giant False Horn", "French Plantain"],
  SPOT: ["Orange-Fleshed (OFSP)", "White Local"],
  VEG: ["Bitterball", "Okra", "Water Greens"],
});

const LOCAL_UNITS = [opt('cup', 'Cups'), opt('tin', 'Tins'), opt('bag', 'Bags (50 kg)'), opt('kg', 'Kilograms')];

/** Existing harvest unit strings and farmer wording -> a KG_PER_UNIT key (or null). */
function normalizeUnit(unit) {
  const u = String(unit || '').trim().toLowerCase();
  if (['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms'].includes(u)) return 'kg';
  if (['tonne', 'tonnes', 'ton', 'tons', 'mt'].includes(u)) return 'tonne';
  if (['bag', 'bags', '50kg bag', '50kg bags', '50 kg bag', '50 kg bags'].includes(u)) return 'bag';
  if (['cup', 'cups'].includes(u)) return 'cup';
  if (['tin', 'tins'].includes(u)) return 'tin';
  return null; // bunches, heads, crates...: no weight
}

const round2 = (n) => Math.round(n * 100) / 100;

/** @returns {{kg:number, kgPerUnit:number, unit:string, estimated:boolean}|null} */
function toKg({ quantity, unit, cropCode }) {
  const q = Number(quantity);
  const key = normalizeUnit(unit);
  if (!key || !Number.isFinite(q) || q < 0) return null;
  const override = cropCode && KG_PER_UNIT_BY_CROP_CODE[cropCode] && KG_PER_UNIT_BY_CROP_CODE[cropCode][key];
  const kgPerUnit = override || KG_PER_UNIT[key];
  return { kg: round2(q * kgPerUnit), kgPerUnit, unit: key, estimated: ESTIMATED_UNITS.includes(key) };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
const isoDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));
const todayISO = (now = new Date()) => now.toISOString().slice(0, 10);

function oneOf(list, value, field) {
  if (!values(list).includes(value)) throw new Error(`Invalid ${field}`);
  return value;
}
function optionalOneOf(list, value, field) {
  return value === null || value === undefined || value === '' ? null : oneOf(list, value, field);
}
function money(value, field) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new Error(`Invalid ${field}`);
  return round2(n);
}
function positive(value, field, max = 1e7) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > max) throw new Error(`Invalid ${field}`);
  return round2(n);
}
function currencyOf(value) {
  const c = value || DEFAULT_CURRENCY;
  if (!CURRENCIES.includes(c)) throw new Error('Invalid currency');
  return c;
}
const text = (v, max = 120) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim().slice(0, max));

// ---------------------------------------------------------------------------
// One-per-season rows get an ID derived from the season, so two phones that both create the
// row for the same season produce the SAME id and merge instead of colliding on the unique
// season_id column.
// ---------------------------------------------------------------------------
/** XOR masks (32 hex digits). XOR is one-to-one, so different seasons can never share a row id. */
const ROW_ID_MASK = Object.freeze({
  details: 'd37a11c0de7a11c0d37a11c0de7a11c0',
  weather: 'e47be700e47be700e47be700e47be700',
});
function stableRowId(kind, seasonId) {
  const mask = ROW_ID_MASK[kind];
  const hex = String(seasonId).toLowerCase().replace(/-/g, '');
  if (!mask || !/^[0-9a-f]{32}$/.test(hex)) return generateUUID();
  let out = '';
  for (let i = 0; i < 32; i++) out += (parseInt(hex[i], 16) ^ parseInt(mask[i], 16)).toString(16);
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}-${out.slice(16, 20)}-${out.slice(20)}`;
}

// ---------------------------------------------------------------------------
// Season details (one row per season; every field optional)
// ---------------------------------------------------------------------------
const DETAIL_FIELDS = [
  'field_type', 'previous_crop_id', 'previous_crop_name', 'fallow_months', 'land_preparation', 'variety_label',
  'seed_source', 'seed_qty_local', 'seed_unit_local', 'seed_kg_per_unit', 'seed_kg', 'intercropped',
  'storage_method', 'storage_months', 'storage_loss_kg', 'home_price_per_kg', 'home_price_currency',
  'reflection_choice', 'reflection_audio_path',
];

/**
 * Apply a patch to a season's details. One tap = one patch, e.g. {field_type: 'upland'}.
 * Unknown fields are ignored; wrong values throw. Seed quantity is converted to kg here.
 */
function mergeSeasonDetails(existing, patch, { seasonId, cropCode, now = new Date() } = {}) {
  const base = existing || { id: stableRowId('details', seasonId), season_id: seasonId, created_at: now.toISOString() };
  const next = { ...base };
  const has = (k) => Object.prototype.hasOwnProperty.call(patch, k);

  if (has('field_type')) next.field_type = optionalOneOf(FIELD_TYPES, patch.field_type, 'field type');
  if (has('previous_crop_id')) next.previous_crop_id = text(patch.previous_crop_id, 60);
  if (has('previous_crop_name')) next.previous_crop_name = text(patch.previous_crop_name, 60);
  if (has('fallow_months')) {
    next.fallow_months = patch.fallow_months === null ? null : Math.round(positiveOrZero(patch.fallow_months, 'fallow length', 600));
  }
  if (has('land_preparation')) {
    const list = Array.isArray(patch.land_preparation) ? patch.land_preparation : [];
    next.land_preparation = [...new Set(list.map((v) => oneOf(LAND_PREPARATION, v, 'land preparation')))];
  }
  if (has('variety_label')) next.variety_label = text(patch.variety_label, 60);
  if (has('seed_source')) next.seed_source = optionalOneOf(SEED_SOURCES, patch.seed_source, 'seed source');
  if (has('intercropped')) next.intercropped = patch.intercropped === null ? null : Boolean(patch.intercropped);
  if (has('seed_qty_local') || has('seed_unit_local')) {
    const q = has('seed_qty_local') ? patch.seed_qty_local : next.seed_qty_local;
    const u = has('seed_unit_local') ? patch.seed_unit_local : next.seed_unit_local;
    if (q === null || q === undefined || q === '') {
      next.seed_qty_local = null; next.seed_unit_local = u || null; next.seed_kg_per_unit = null; next.seed_kg = null;
    } else {
      const conv = toKg({ quantity: positive(q, 'seed quantity'), unit: u, cropCode });
      if (!conv) throw new Error('Invalid seed unit');
      next.seed_qty_local = Number(q);
      next.seed_unit_local = conv.unit;
      next.seed_kg_per_unit = conv.kgPerUnit;
      next.seed_kg = conv.kg;
    }
  }
  if (has('storage_method')) next.storage_method = optionalOneOf(STORAGE_METHODS, patch.storage_method, 'storage method');
  if (has('storage_months')) next.storage_months = patch.storage_months === null ? null : positive(patch.storage_months, 'storage months', 120);
  if (has('storage_loss_kg')) next.storage_loss_kg = money(patch.storage_loss_kg, 'storage loss');
  if (has('home_price_per_kg')) next.home_price_per_kg = money(patch.home_price_per_kg, 'home price');
  if (has('home_price_currency')) next.home_price_currency = patch.home_price_currency ? currencyOf(patch.home_price_currency) : null;
  if (has('reflection_choice')) next.reflection_choice = optionalOneOf(REFLECTION_CHOICES, patch.reflection_choice, 'reflection');
  if (has('reflection_audio_path')) next.reflection_audio_path = text(patch.reflection_audio_path, 300);

  next.updated_at = now.toISOString();
  return next;
}
function positiveOrZero(value, field, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(`Invalid ${field}`);
  return n;
}

// ---------------------------------------------------------------------------
// List entries: labour, problems, where the harvest went (sales fields live on a "sold" row)
// ---------------------------------------------------------------------------
function buildLaborEntry({ seasonId, laborType, days, cost, currency, note, now = new Date() }) {
  return {
    id: generateUUID(),
    season_id: seasonId,
    labor_type: oneOf(LABOR_TYPES, laborType, 'labour type'),
    days: positive(days, 'days', 3650),
    cost: money(cost, 'cost') ?? 0,
    currency: currencyOf(currency),
    note: text(note),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

function buildProblem({ seasonId, problemType, severity, date, detail, now = new Date() }) {
  const when = date || todayISO(now);
  if (!isoDate(when)) throw new Error('Invalid date');
  return {
    id: generateUUID(),
    season_id: seasonId,
    problem_type: oneOf(PROBLEM_TYPES, problemType, 'problem'),
    severity: oneOf(SEVERITIES, severity || 'small', 'severity'),
    problem_date: when,
    detail: text(detail, 80),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

/**
 * Where a harvest (or part of it) went. "sold" rows also carry the sale: price per unit,
 * month sold, buyer or market, transport cost. Currency is stored on the row.
 */
function buildDisposal({ seasonId, harvestId = null, destination, quantity, unit, cropCode, lossReason, sale = {}, now = new Date() }) {
  const dest = oneOf(DESTINATIONS, destination, 'destination');
  const qty = positive(quantity, 'quantity');
  const conv = toKg({ quantity: qty, unit, cropCode });
  if (!conv && !normalizeUnit(unit) && !String(unit || '').trim()) throw new Error('Invalid unit');
  const row = {
    id: generateUUID(),
    season_id: seasonId,
    harvest_id: harvestId,
    destination: dest,
    qty_local: qty,
    unit_local: conv ? conv.unit : String(unit).trim().slice(0, 20),
    kg_per_unit: conv ? conv.kgPerUnit : null,
    qty_kg: conv ? conv.kg : null,
    loss_reason: dest === 'lost' ? optionalOneOf(LOSS_REASONS, lossReason, 'loss reason') : null,
    price_per_unit: null,
    sale_currency: null,
    sold_month: null,
    buyer_market: null,
    transport_cost: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  if (dest === 'sold') {
    row.price_per_unit = money(sale.pricePerUnit, 'price');
    row.sale_currency = currencyOf(sale.currency);
    const month = sale.month || todayISO(now).slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid month');
    row.sold_month = month;
    row.buyer_market = text(sale.buyerMarket, 80);
    row.transport_cost = money(sale.transportCost, 'transport cost') ?? 0;
  }
  return row;
}

/** Totals of where the harvest went, in kg, and how much is not yet accounted for. */
function summarizeHarvestUse(disposals, harvestedKg = null) {
  const kg = { sold: 0, eaten: 0, seed: 0, lost: 0 };
  const lostBy = {};
  let withoutKg = 0;
  for (const d of disposals || []) {
    if (d.qty_kg === null || d.qty_kg === undefined) { withoutKg++; continue; }
    kg[d.destination] = round2((kg[d.destination] || 0) + d.qty_kg);
    if (d.destination === 'lost') {
      const why = d.loss_reason || 'other';
      lostBy[why] = round2((lostBy[why] || 0) + d.qty_kg);
    }
  }
  const accounted = round2(kg.sold + kg.eaten + kg.seed + kg.lost);
  return {
    kg,
    lostBy,
    accounted,
    unaccounted: harvestedKg === null || harvestedKg === undefined ? null : round2(Math.max(0, harvestedKg - accounted)),
    over: harvestedKg !== null && harvestedKg !== undefined && accounted > harvestedKg + 0.005,
    withoutKg,
  };
}

// ---------------------------------------------------------------------------
// Costs that belong to a season
// ---------------------------------------------------------------------------
const DAY_MS = 86400000;
const dayMs = (iso) => Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);

/** [planting, end] of a season for cost attribution. */
function seasonPeriod(season, harvests = [], now = new Date()) {
  const today = todayISO(now);
  const lastHarvest = harvests
    .filter((h) => h.season_id === season.id && !h.deleted_at && isoDate((h.harvest_date || '').slice(0, 10)))
    .map((h) => h.harvest_date.slice(0, 10))
    .sort()
    .pop();
  const end = lastHarvest && lastHarvest < today ? lastHarvest : today;
  return { start: (season.planting_date || today).slice(0, 10), end };
}

/**
 * Costs recorded against this season. A cost counts when it is linked to the season, or when
 * it is on the same farm inside the season's dates and no other season of that farm overlaps
 * (otherwise it cannot be told whose cost it is, so it is reported as `shared`, not added).
 */
function attributeSeasonCosts({ season, seasonsOnFarm = [], harvests = [], expenses = [], inputs = [], activities = [], now = new Date() }) {
  const mine = seasonPeriod(season, harvests, now);
  const others = seasonsOnFarm.filter((s) => s.id !== season.id && s.status !== 'cancelled' && s.farm_id === season.farm_id);
  const overlaps = others.some((s) => {
    const p = seasonPeriod(s, harvests, now);
    return p.start <= mine.end && p.end >= mine.start;
  });
  const dateOf = (r, ...keys) => {
    for (const k of keys) if (r[k]) return String(r[k]).slice(0, 10);
    return null;
  };
  const split = (rows, ...dateKeys) => {
    const included = [];
    const shared = [];
    for (const r of rows) {
      if (r.deleted_at) continue;
      if (r.season_id === season.id) { included.push(r); continue; }
      if (r.season_id || r.farm_id !== season.farm_id) continue;
      const d = dateOf(r, ...dateKeys);
      if (!d || d < mine.start || d > mine.end) continue;
      (overlaps ? shared : included).push(r);
    }
    return { included, shared };
  };
  const e = split(expenses, 'expense_date', 'created_at');
  const i = split(inputs, 'purchase_date', 'created_at');
  const a = split(activities, 'activity_date', 'created_at');
  return {
    expenses: e.included,
    inputs: i.included,
    activities: a.included,
    sharedCount: e.shared.length + i.shared.length + a.shared.length,
    period: mine,
  };
}

// ---------------------------------------------------------------------------
// Profit, with home food kept apart from cash
// ---------------------------------------------------------------------------
const blank = (currency) => ({
  currency, revenue: 0, transportCost: 0, laborCost: 0, expenseCost: 0, inputCost: 0, activityCost: 0, cashCosts: 0, cashProfit: 0,
});

/**
 * Cash profit per currency (no currency conversion: LRD and USD are never mixed), and the
 * value of food kept for home as a SEPARATE line, using the farmer's own price estimate.
 * Home food is never added to cash profit.
 *
 * Activity costs have no currency in the app and are USD (as in the existing profit screens).
 */
function summarizeSeasonProfit({ details = null, disposals = [], labor = [], costs = {} }) {
  const by = {};
  const line = (c) => by[c] || (by[c] = blank(c));

  for (const d of disposals) {
    if (d.destination !== 'sold') continue;
    const c = d.sale_currency || DEFAULT_CURRENCY;
    if (d.price_per_unit !== null && d.price_per_unit !== undefined) line(c).revenue += d.qty_local * d.price_per_unit;
    if (d.transport_cost) line(c).transportCost += d.transport_cost;
  }
  for (const l of labor) if (l.cost) line(l.currency || DEFAULT_CURRENCY).laborCost += l.cost;
  for (const e of costs.expenses || []) line(e.currency || 'USD').expenseCost += Number(e.amount) || 0;
  for (const i of costs.inputs || []) line(i.currency || 'USD').inputCost += Number(i.cost) || 0;
  for (const a of costs.activities || []) if (a.cost) line('USD').activityCost += Number(a.cost) || 0;

  const currencies = Object.values(by)
    .map((l) => {
      const out = { ...l };
      for (const k of ['revenue', 'transportCost', 'laborCost', 'expenseCost', 'inputCost', 'activityCost']) out[k] = round2(l[k]);
      out.cashCosts = round2(out.transportCost + out.laborCost + out.expenseCost + out.inputCost + out.activityCost);
      out.cashProfit = round2(out.revenue - out.cashCosts);
      return out;
    })
    .filter((l) => l.revenue || l.cashCosts)
    .sort((a, b) => CURRENCIES.indexOf(a.currency) - CURRENCIES.indexOf(b.currency));

  const eatenKg = round2(disposals.filter((d) => d.destination === 'eaten' && d.qty_kg).reduce((s, d) => s + d.qty_kg, 0));
  const price = details && details.home_price_per_kg;
  const homeFood = {
    kg: eatenKg,
    pricePerKg: price ?? null,
    currency: (details && details.home_price_currency) || DEFAULT_CURRENCY,
    value: price !== null && price !== undefined ? round2(eatenKg * price) : null,
    needsPrice: eatenKg > 0 && (price === null || price === undefined),
  };
  return { currencies, homeFood };
}

module.exports = {
  FIELD_TYPES,
  LAND_PREPARATION,
  FALLOW_LENGTHS,
  SEED_SOURCES,
  LABOR_TYPES,
  PROBLEM_TYPES,
  DISEASE_SUGGESTIONS,
  SEVERITIES,
  DESTINATIONS,
  LOSS_REASONS,
  STORAGE_METHODS,
  STORAGE_MONTHS,
  REFLECTION_CHOICES,
  CURRENCIES,
  DEFAULT_CURRENCY,
  LOCAL_UNITS,
  VARIETIES_BY_CROP_CODE,
  KG_PER_UNIT,
  KG_PER_UNIT_BY_CROP_CODE,
  ESTIMATED_UNITS,
  DETAIL_FIELDS,
  labelOf,
  stableRowId,
  normalizeUnit,
  toKg,
  mergeSeasonDetails,
  buildLaborEntry,
  buildProblem,
  buildDisposal,
  summarizeHarvestUse,
  seasonPeriod,
  attributeSeasonCosts,
  summarizeSeasonProfit,
};
