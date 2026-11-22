'use strict';
/**
 * Stateless USSD menu handler.
 *
 * The aggregator sends every input so far joined by "*" in `text`. On each request
 * we replay those inputs through a small state machine (starting at the root menu)
 * to work out the current screen. Nothing is stored between requests.
 *
 *   "0"  -> back one screen      "00" -> main menu
 *   invalid input -> same screen again with a short error line
 *
 * Screens that show stored records declare `needs`; those records are loaded
 * once per request, only when such a screen is reached.
 *
 * Saves happen only when the replay ends on a confirm. Record IDs are derived from
 * sessionId + inputs, so a retried request upserts the same rows (no duplicates).
 */
const crypto = require('node:crypto');
const shared = require('../../src/shared/farmRecords');
const { createRegistration, labelOf } = require('./registerFarm');
const { hashPin, verifyPin, weakPinReason, lockMinutesLeft, PIN_PATTERN, MAX_ATTEMPTS, LOCK_MINUTES } = require('./pin');
const { accountSms } = require('./sms');

const { CROPS, LIBERIA_COUNTIES, SIMPLE_EXPENSE_CATEGORIES, USSD_TAG, FARM_OPTIONS } = shared;

const MAX_SCREEN_CHARS = 160;
const COUNTY_PAGE_SIZE = 8;
const MORE = '98';
const MAX_FARMS_LISTED = 6;
const NAV_FOOTER = '0 Back  00 Menu';
const BUSY_MESSAGE = 'Sorry, the service is busy. Please try again later.';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const go = (screen, data) => ({ go: screen, data });
const end = (action, data) => ({ end: action, data });
const err = (error) => ({ error });

const short = (s, n) => {
  const str = String(s || '');
  return str.length > n ? `${str.slice(0, n - 1)}.` : str;
};
const firstName = (full) => short(String(full || '').trim().split(/\s+/)[0] || 'farmer', 14);
const fmtNum = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const fmtUsd = (n) => `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const numbered = (items, start = 1) => items.map((x, i) => `${i + start}. ${x}`).join('\n');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-11-19' -> '19 Nov' (adds the year when it is not the current one). */
function fmtDate(iso, now) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const label = `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
  return now && Number(m[1]) !== now.getFullYear() ? `${label} ${m[1]}` : label;
}
const newestFirst = (dateKey) => (a, b) =>
  String(b[dateKey] || b.created_at).localeCompare(String(a[dateKey] || a.created_at)) ||
  String(b.created_at).localeCompare(String(a.created_at));

function parseInputs(text) {
  if (text == null || text === '') return [];
  return String(text).split('*').map((s) => s.trim());
}

/** Positive number, max 2 decimals, up to 1,000,000. */
function parseAmount(input) {
  const s = String(input).replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n <= 1e6 ? n : null;
}

/** Person / farm name: letters required; letters, digits, space . ' - allowed. */
function parseName(input, max) {
  const s = String(input).replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > max) return null;
  if (!/[A-Za-z]/.test(s) || !/^[A-Za-z0-9 .'-]+$/.test(s)) return null;
  return s;
}

/** DDMMYYYY (separators optional), a real date, age 16 to 110. Returns { iso, year } or null. */
function parseBirthDate(input, now) {
  const m = String(input).trim().match(/^(\d{2})[-/.]?(\d{2})[-/.]?(\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d, 12));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  const age = now.getUTCFullYear() - y - (now.getTime() < Date.UTC(now.getUTCFullYear(), mo - 1, d) ? 1 : 0);
  if (age < 16 || age > 110) return null;
  return { iso: `${m[3]}-${m[2]}-${m[1]}`, year: y };
}

function pickIndex(input, count) {
  if (!/^\d{1,2}$/.test(input)) return -1;
  const i = Number(input) - 1;
  return i >= 0 && i < count ? i : -1;
}

const cropById = (id) => CROPS.find((c) => c.id === id);
const farmById = (ctx, id) => ctx.farms.find((f) => f.id === id);

// ---------------------------------------------------------------------------
// Screens: prompt(ctx, data) -> text, handle(input, ctx, data) -> go | end | err
// ---------------------------------------------------------------------------
const FLOW_FIRST_STEP = { harvest: 'h_crop', expense: 'e_cat', summary: null };

/** Route into a flow that needs a farm: none -> prompt to register, one -> use it, many -> pick. */
function withFarm(ctx, flow) {
  if (ctx.farms.length === 0) return go('no_farm', {});
  if (flow === 'summary') return end('summary', {});
  if (ctx.farms.length === 1) return go(FLOW_FIRST_STEP[flow], { farmId: ctx.farms[0].id });
  return go('pick_farm', { flow });
}

function countyPicker(nextScreen, title) {
  return {
    prompt: (ctx, data) => {
      const page = data.page || 0;
      const start = page * COUNTY_PAGE_SIZE;
      const names = LIBERIA_COUNTIES.slice(start, start + COUNTY_PAGE_SIZE).map((c) => c.name);
      const more = start + COUNTY_PAGE_SIZE < LIBERIA_COUNTIES.length ? `\n${MORE}. More` : '';
      return `${title}\n${numbered(names, start + 1)}${more}`;
    },
    handle: (input, ctx, data) => {
      const page = data.page || 0;
      if (input === MORE && (page + 1) * COUNTY_PAGE_SIZE < LIBERIA_COUNTIES.length) {
        return go(null, { ...data, page: page + 1 }); // null = same screen
      }
      const i = pickIndex(input, LIBERIA_COUNTIES.length);
      if (i < 0) return err('Invalid choice.');
      const { page: _p, ...rest } = data;
      return nextScreen === 'weather' ? end('weather', { county: LIBERIA_COUNTIES[i].name }) : go(nextScreen, { ...rest, county: LIBERIA_COUNTIES[i].name });
    },
  };
}

function cropPicker(nextScreen, title) {
  return {
    prompt: () => `${title}\n${numbered(CROPS.map((c) => c.name))}`,
    handle: (input, ctx, data) => {
      const i = pickIndex(input, CROPS.length);
      return i < 0 ? err('Invalid choice.') : go(nextScreen, { ...data, cropId: CROPS[i].id });
    },
  };
}

const LIST_PAGE_SIZE = 4;

/** Read-only, paginated list screen (98 = more, 0 = previous page / back). */
function pagedList({ title, empty, needs, rows }) {
  return {
    needs,
    prompt: (ctx, data) => {
      const all = rows(ctx, data);
      if (all.length === 0) return empty;
      const start = (data.page || 0) * LIST_PAGE_SIZE;
      const page = all.slice(start, start + LIST_PAGE_SIZE).map((l) => short(l, 32));
      const more = start + LIST_PAGE_SIZE < all.length ? `\n${MORE}. More` : '';
      return `${title} ${start + 1}-${start + page.length} of ${all.length}:\n${page.join('\n')}${more}`;
    },
    handle: (input, ctx, data) => {
      const hasMore = ((data.page || 0) + 1) * LIST_PAGE_SIZE < rows(ctx, data).length;
      if (input === MORE && hasMore) return go(null, { ...data, page: (data.page || 0) + 1 });
      return err(hasMore ? 'Press 98 for more.' : 'Press 0 to go back.');
    },
  };
}

/** Lazy, per-request loaders for screens that display stored records. */
const LOADERS = {
  seasons: (ctx, repo) => repo.getSeasons(ctx.farms.map((f) => f.id)),
  harvests: (ctx, repo) => repo.getHarvests(ctx.farmer.id),
  expenses: (ctx, repo) => repo.getExpenses(ctx.farms.map((f) => f.id)),
};

async function ensureRecords(ctx, needs) {
  for (const key of needs || []) {
    if (!(key in ctx.records)) ctx.records[key] = await LOADERS[key](ctx, ctx.repo);
  }
}

const registration = createRegistration({ go, end, err, short, numbered, pickIndex, parseName, parseAmount, firstName, fmtNum, stableId, MORE });

/** Read-only detail screen: a list of lines, 4 per page (98 = more). */
const DETAIL_LINES_PER_PAGE = 4;
function detailView({ needs, lines }) {
  return {
    needs,
    prompt: (ctx, data) => {
      const all = lines(ctx, data);
      const start = (data.page || 0) * DETAIL_LINES_PER_PAGE;
      const rows = all.slice(start, start + DETAIL_LINES_PER_PAGE).map((l) => short(l, 34));
      const more = start + DETAIL_LINES_PER_PAGE < all.length ? `\n${MORE}. More` : '';
      return rows.join('\n') + more;
    },
    handle: (input, ctx, data) => {
      const hasMore = ((data.page || 0) + 1) * DETAIL_LINES_PER_PAGE < lines(ctx, data).length;
      if (input === MORE && hasMore) return go(null, { ...data, page: (data.page || 0) + 1 });
      return err(hasMore ? 'Press 98 for more.' : 'Press 0 to go back.');
    },
  };
}

const TYPE_SHORT = { crops: 'Crops', livestock: 'Livestock', both: 'Mixed' };
const yesNo = (v) => (v ? 'Yes' : 'No');
const cropNamesFor = (ctx, farmId) => [
  ...new Set(ctx.records.seasons.filter((s) => s.farm_id === farmId).map((s) => (cropById(s.crop_id) || {}).name).filter(Boolean)),
];

const SCREENS = {
  // ---- Create an account by USSD (the same details as the app, plus a PIN) -----------------------------
  acct_name: {
    prompt: () => 'Welcome to FarmTori!\nCreate your account.\nEnter your full name:',
    handle: (input, ctx, data) => {
      const fullName = parseName(input, 40);
      return fullName ? go('acct_dob', { ...data, fullName }) : err('Please enter your name.');
    },
  },
  acct_dob: {
    prompt: () => 'Date of birth\n(DDMMYYYY, e.g. 15031985):',
    handle: (input, ctx, data) => {
      const dob = parseBirthDate(input, ctx.now);
      return dob ? go('acct_gender', { ...data, dob: dob.iso, birthYear: dob.year }) : err('Use DDMMYYYY, e.g. 15031985.');
    },
  },
  acct_gender: {
    prompt: () => 'Gender:\n1. Male\n2. Female',
    handle: (input, ctx, data) => (input === '1' || input === '2' ? go('acct_county', { ...data, gender: input === '1' ? 'Male' : 'Female' }) : err('Invalid choice.')),
  },
  acct_county: countyPicker('acct_town', 'Which county do you live in?'),
  acct_town: {
    prompt: () => 'Enter your community or town:',
    handle: (input, ctx, data) => {
      const community = parseName(input, 40);
      return community ? go('acct_pin', { ...data, community }) : err('Please enter a place name.');
    },
  },
  acct_pin: {
    prompt: (ctx, data) => `${data.pinMismatch ? 'The PINs did not match.\n' : ''}Create a 4-digit PIN.\nKeep it secret:`,
    handle: (input, ctx, data) => {
      const reason = weakPinReason(input, { phone: ctx.phone, birthYear: data.birthYear });
      return reason ? err(reason) : go('acct_pin2', { ...data, pin: input, pinMismatch: false });
    },
  },
  acct_pin2: {
    prompt: () => 'Enter the PIN again to confirm:',
    handle: (input, ctx, data) => {
      if (input === data.pin) return go('acct_confirm', data);
      const { pin: _pin, ...rest } = data;
      return go('acct_pin', { ...rest, pinMismatch: true });
    },
  },
  acct_confirm: {
    prompt: (ctx, data) => `Create account?\n${short(data.fullName, 24)}\n${short(data.community, 18)}, ${data.county}\n1. Create\n2. Cancel`,
    handle: (input, ctx, data) => (input === '1' ? end('create_account', data) : input === '2' ? end('cancel', {}) : err('Press 1 to create or 2 to cancel.')),
  },

  // An existing farmer who has no PIN yet must choose one before anything else.
  pin_new: {
    prompt: (ctx, data) => `${data.pinMismatch ? 'The PINs did not match.\n' : ''}For your security, create a 4-digit PIN.\nKeep it secret:`,
    handle: (input, ctx) => {
      const reason = weakPinReason(input, { phone: ctx.phone });
      return reason ? err(reason) : go('pin_new2', { pin: input });
    },
  },
  pin_new2: {
    prompt: () => 'Enter the PIN again to confirm:',
    handle: (input, ctx, data) => (input === data.pin ? end('save_pin', { pin: input }) : go('pin_new', { pinMismatch: true })),
  },

  // Root for phones with no farmer account (the older flow, used when PINs are not switched on).
  reg_name: {
    prompt: () => 'Welcome to FarmTori!\nThis number is not registered.\nEnter your full name:',
    handle: (input, ctx, data) => {
      const fullName = parseName(input, 40);
      return fullName ? go('f_name', { ...data, fullName }) : err('Please enter your name.');
    },
  },

  // Root for registered farmers.
  main: {
    prompt: (ctx) =>
      `FarmTori - Hi ${firstName(ctx.farmer.full_name)}\n1. Register farm\n2. Record harvest\n3. Record expense\n4. My farm summary\n5. Weather forecast\n6. My records`,
    handle: (input, ctx) => {
      switch (input) {
        case '1': return go('f_name', {});
        case '2': return withFarm(ctx, 'harvest');
        case '3': return withFarm(ctx, 'expense');
        case '4': return withFarm(ctx, 'summary');
        case '5': return go('w_county', { page: 0 });
        case '6': return ctx.farms.length ? go('records', {}) : go('no_farm', {});
        default: return err('Invalid choice.');
      }
    },
  },

  no_farm: {
    prompt: () => 'You have no farm yet.\n1. Register farm',
    handle: (input) => (input === '1' ? go('f_name', {}) : err('Invalid choice.')),
  },

  pick_farm: {
    prompt: (ctx) => `Select farm:\n${numbered(ctx.farms.slice(0, MAX_FARMS_LISTED).map((f) => short(f.name, 22)))}`,
    handle: (input, ctx, data) => {
      const i = pickIndex(input, Math.min(ctx.farms.length, MAX_FARMS_LISTED));
      if (i < 0) return err('Invalid choice.');
      return go(FLOW_FIRST_STEP[data.flow], { farmId: ctx.farms[i].id });
    },
  },

  // --- Register farm (full flow in registerFarm.js) --------------------------
  ...registration.screens,

  // --- Record harvest ------------------------------------------------------
  h_crop: cropPicker('h_qty', 'Which crop did you harvest?'),
  h_qty: {
    prompt: (ctx, data) => {
      const crop = cropById(data.cropId);
      return `Enter ${crop.name} quantity in ${crop.default_unit}:`;
    },
    handle: (input, ctx, data) => {
      const quantity = parseAmount(input);
      return quantity ? go('h_confirm', { ...data, quantity }) : err('Enter a number, e.g. 250.');
    },
  },
  h_confirm: {
    prompt: (ctx, data) => {
      const crop = cropById(data.cropId);
      const farm = farmById(ctx, data.farmId);
      return `Save harvest?\n${crop.name}: ${fmtNum(data.quantity)} ${crop.default_unit}\nFarm: ${short(farm && farm.name, 30)}\n1. Save\n2. Cancel`;
    },
    handle: (input, ctx, data) =>
      input === '1' ? end('save_harvest', data) : input === '2' ? end('cancel', {}) : err('Press 1 to save or 2 to cancel.'),
  },

  // --- Record expense ------------------------------------------------------
  e_cat: {
    prompt: () => `Expense type:\n${numbered(SIMPLE_EXPENSE_CATEGORIES.map((c) => c.label))}`,
    handle: (input, ctx, data) => {
      const i = pickIndex(input, SIMPLE_EXPENSE_CATEGORIES.length);
      return i < 0 ? err('Invalid choice.') : go('e_amount', { ...data, expenseKey: SIMPLE_EXPENSE_CATEGORIES[i].key });
    },
  },
  e_amount: {
    prompt: (ctx, data) => `Enter ${expenseCategory(data).label.toLowerCase()} amount in USD:`,
    handle: (input, ctx, data) => {
      const amount = parseAmount(input);
      return amount ? go('e_confirm', { ...data, amount }) : err('Enter a number, e.g. 40.');
    },
  },
  e_confirm: {
    prompt: (ctx, data) => {
      const farm = farmById(ctx, data.farmId);
      return `Save expense?\n${expenseCategory(data).label}: $${fmtNum(data.amount)}\nFarm: ${short(farm && farm.name, 30)}\n1. Save\n2. Cancel`;
    },
    handle: (input, ctx, data) =>
      input === '1' ? end('save_expense', data) : input === '2' ? end('cancel', {}) : err('Press 1 to save or 2 to cancel.'),
  },

  // --- View my records -----------------------------------------------------
  records: {
    prompt: () => 'My records:\n1. My farms\n2. Recent harvests\n3. Recent expenses',
    handle: (input, ctx) => {
      switch (input) {
        case '1': return ctx.farms.length === 1 ? go('farm_view', { farmId: ctx.farms[0].id }) : go('farm_list', {});
        case '2': return go('harvest_list', { page: 0 });
        case '3': return go('expense_list', { page: 0 });
        default: return err('Invalid choice.');
      }
    },
  },
  farm_list: {
    prompt: (ctx) => `My farms:\n${numbered(ctx.farms.slice(0, MAX_FARMS_LISTED).map((f) => short(f.name, 22)))}`,
    handle: (input, ctx) => {
      const i = pickIndex(input, Math.min(ctx.farms.length, MAX_FARMS_LISTED));
      return i < 0 ? err('Invalid choice.') : go('farm_view', { farmId: ctx.farms[i].id });
    },
  },
  farm_view: {
    needs: ['seasons', 'harvests', 'expenses'],
    prompt: (ctx, data) => {
      const farm = farmById(ctx, data.farmId);
      const { harvests, expenses } = ctx.records;
      const nHarvests = harvests.filter((h) => h.farm_id === farm.id).length;
      const spent = expenses
        .filter((e) => e.farm_id === farm.id && (e.currency || 'USD') === 'USD')
        .reduce((t, e) => t + (Number(e.amount) || 0), 0);
      const place = farm.district && farm.district !== 'Not set' ? `${farm.county}, ${short(farm.district, 14)}` : farm.county;
      const type = TYPE_SHORT[farm.farming_type || 'crops'];
      const size = `${fmtNum(farm.size)} ${Number(farm.size) === 1 ? String(farm.size_unit || 'acres').replace(/s$/, '') : farm.size_unit || 'acres'}`;
      const options = farm.livestock_details ? '3. Details  4. Livestock' : '3. Farm details';
      const build = (n, p, t) => [short(farm.name, n), p, `${size}${t ? ` - ${type}` : ''}`, `Harvests: ${nHarvests}  Spent: ${fmtUsd(spent)}`, '1. Harvests  2. Expenses', options].join('\n');
      // Leave room for an error line: shorten step by step if needed.
      for (const [n, p, t] of [[26, place, true], [26, farm.county, true], [20, farm.county, false]]) {
        const text = build(n, p, t);
        if (text.length <= MAX_SCREEN_CHARS - 22) return text;
      }
      return build(20, farm.county, false);
    },
    handle: (input, ctx, data) => {
      const farm = farmById(ctx, data.farmId);
      if (input === '1') return go('harvest_list', { farmId: data.farmId, page: 0 });
      if (input === '2') return go('expense_list', { farmId: data.farmId, page: 0 });
      if (input === '3') return go('farm_more', { farmId: data.farmId, page: 0 });
      if (input === '4' && farm.livestock_details) return go('farm_animals', { farmId: data.farmId, page: 0 });
      return err('Invalid choice.');
    },
  },
  farm_more: detailView({
    needs: ['seasons'],
    lines: (ctx, data) => {
      const farm = farmById(ctx, data.farmId);
      const crops = cropNamesFor(ctx, farm.id);
      return [
        `Community: ${farm.community || '-'}`,
        `Land: ${labelOf(FARM_OPTIONS.tenureTypes, farm.ownership_type)}`,
        `Soil: ${labelOf(FARM_OPTIONS.soilTypes, farm.soil_type)}`,
        `Irrigation: ${yesNo(farm.irrigation)}`,
        ...(crops.length ? [`Crops: ${crops.join(', ')}`] : []),
        `Registered: ${fmtDate(farm.registration_date || farm.created_at, ctx.now)}`,
      ];
    },
  }),
  farm_animals: detailView({
    needs: [],
    lines: (ctx, data) => {
      const d = farmById(ctx, data.farmId).livestock_details || {};
      const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
      return [
        `${list(d.selected_animals).join(', ') || d.animal_type || 'Animals'}: ${d.head_count || 0} head`,
        ...(d.breed ? [`Breed: ${d.breed}`] : []),
        `Purpose: ${list(d.production_purpose).map((v) => labelOf(FARM_OPTIONS.productionPurposes, v)).join(', ') || '-'}`,
        `System: ${d.management_system || '-'}`,
        `Housing: ${labelOf(FARM_OPTIONS.housingTypes, d.housing_type)}`,
        ...(d.housing_size || d.housing_capacity
          ? [`Pen: ${[d.housing_size, d.housing_capacity ? `${d.housing_capacity} animals` : null].filter(Boolean).join(', ')}`]
          : []),
        `Grazing: ${d.grazing_availability ? labelOf(FARM_OPTIONS.grazingArrangements, d.grazing_arrangement) : 'None'}`,
        ...(d.grazing_area ? [`Grazing area: ${d.grazing_area}`] : []),
        `Water: ${d.water_source || '-'}`,
        `Feed: ${labelOf(FARM_OPTIONS.feedingSystems, d.feeding_system)}`,
      ];
    },
  }),
  harvest_list: pagedList({
    title: 'Harvests',
    empty: 'No harvests recorded yet.\nChoose 2 on the main menu to add one.',
    needs: ['harvests'],
    rows: (ctx, data) =>
      ctx.records.harvests
        .filter((h) => !data.farmId || h.farm_id === data.farmId)
        .sort(newestFirst('harvest_date'))
        .map((h) => {
          const crop = cropById(h.crop_id);
          return `${fmtDate(h.harvest_date || h.created_at, ctx.now)} ${short(crop ? crop.name : 'Crop', 10)} ${fmtNum(h.quantity)} ${h.unit || 'kg'}`;
        }),
  }),
  expense_list: pagedList({
    title: 'Expenses',
    empty: 'No expenses recorded yet.\nChoose 3 on the main menu to add one.',
    needs: ['expenses'],
    rows: (ctx, data) =>
      ctx.records.expenses
        .filter((e) => !data.farmId || e.farm_id === data.farmId)
        .sort(newestFirst('expense_date'))
        .map((e) => {
          const simple = SIMPLE_EXPENSE_CATEGORIES.find((c) => c.category === e.category);
          const money = `${e.currency === 'LRD' ? 'L$' : '$'}${fmtNum(e.amount)}`;
          return `${fmtDate(e.expense_date || e.created_at, ctx.now)} ${short(simple ? simple.label : e.category, 12)} ${money}`;
        }),
  }),

  // --- Weather -------------------------------------------------------------
  w_county: countyPicker('weather', 'Weather for which county?'),
};

function expenseCategory(data) {
  return SIMPLE_EXPENSE_CATEGORIES.find((c) => c.key === data.expenseKey);
}

// ---------------------------------------------------------------------------
// Replay engine
// ---------------------------------------------------------------------------
function rootScreen(ctx) {
  if (ctx.farmer) return ctx.needsPin ? 'pin_new' : 'main';
  return ctx.pins ? 'acct_name' : 'reg_name';
}

/**
 * Replay inputs from the root screen.
 * @returns {{ state, depth } | { end, data, consumed }}
 */
async function replay(inputs, ctx) {
  const root = rootScreen(ctx);
  let state = { screen: root, data: {}, error: null };
  const history = [];

  for (let n = 0; n < inputs.length; n++) {
    const input = inputs[n];
    if (input === '00') {
      state = { screen: root, data: {}, error: null };
      history.length = 0;
      continue;
    }
    if (input === '0') {
      state = history.length ? { ...history.pop(), error: null } : { ...state, error: null };
      continue;
    }
    await ensureRecords(ctx, SCREENS[state.screen].needs);
    const result = SCREENS[state.screen].handle(input, ctx, state.data);
    if (result.error) {
      state = { ...state, error: result.error };
      continue;
    }
    if (result.end) return { end: result.end, data: result.data, consumed: n + 1 };
    history.push({ screen: state.screen, data: state.data });
    state = { screen: result.go || state.screen, data: result.data, error: null };
  }
  return { state, depth: history.length };
}

/** Keep a screen within the limit: with an error, drop the prompt's title line if needed. */
function composeScreen(prompt, error, showFooter) {
  let body = prompt;
  if (error) {
    body = `${error}\n${prompt}`;
    if (body.length > MAX_SCREEN_CHARS) body = `${error}\n${prompt.split('\n').slice(1).join('\n')}`;
  }
  if (showFooter && body.length + 1 + NAV_FOOTER.length <= MAX_SCREEN_CHARS) body += `\n${NAV_FOOTER}`;
  return clamp(body);
}

function clamp(body) {
  if (body.length <= MAX_SCREEN_CHARS) return body;
  console.warn(`[ussd] screen over ${MAX_SCREEN_CHARS} chars, truncating: ${JSON.stringify(body)}`);
  return body.slice(0, MAX_SCREEN_CHARS);
}

/** Deterministic UUID for this session + inputs + kind, so retries upsert the same row. */
function stableId(ctx, kind) {
  if (!ctx.sessionId) return shared.generateUUID();
  const h = crypto.createHash('sha256').update(`${ctx.sessionId}|${ctx.phone}|${ctx.consumedText}|${kind}`).digest('hex');
  const variant = '89ab'[parseInt(h[16], 16) % 4];
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// ---------------------------------------------------------------------------
// Terminal actions (END screens)
// ---------------------------------------------------------------------------
const ACTIONS = {
  async cancel() {
    return 'Cancelled. Nothing was saved.';
  },

  save_farm: (data, ctx, deps) => registration.save(data, ctx, deps),

  async create_account(data, ctx, { repo, sms }) {
    const record = {
      ...shared.buildFarmerRecord({
        fullName: data.fullName,
        phone: ctx.phone,
        county: data.county,
        community: data.community,
        gender: data.gender,
        dateOfBirth: data.dob,
        now: ctx.now,
      }),
      id: stableId(ctx, 'farmer'),
    };
    const farmer = await repo.createFarmer(record);
    await repo.setPin(farmer.id, hashPin(data.pin), ctx.now); // only the hash is kept
    let note = '';
    if (sms) {
      const sent = await sms.send(ctx.phone, accountSms({ farmerName: farmer.full_name, farmerId: farmer.farmer_id_code }));
      if (sent.ok) note = '\nSMS sent.';
      else console.warn('[ussd] SMS not sent:', sent.error);
    }
    return `Account created!\nFarmer ID: ${farmer.farmer_id_code}\nDial ${ctx.serviceCode} and enter your PIN to register your farm.${note}`;
  },

  async save_pin(data, ctx, { repo }) {
    await repo.setPin(ctx.farmer.id, hashPin(data.pin), ctx.now);
    return `PIN saved.\nDial ${ctx.serviceCode} and enter it to continue.`;
  },

  async save_harvest(data, ctx, { repo }) {
    const crop = cropById(data.cropId);
    const farm = farmById(ctx, data.farmId);
    const county = shared.findCounty(farm.county);
    const seasons = await repo.getSeasons([farm.id]);
    const season = seasons
      .filter((s) => s.crop_id === crop.id && s.status !== 'completed' && s.status !== 'cancelled')
      .sort((a, b) => String(b.planting_date).localeCompare(String(a.planting_date)))[0];

    const harvest = await repo.createHarvest({
      ...shared.buildHarvestRecord({
        farmerId: ctx.farmer.id,
        farmId: farm.id,
        seasonId: season ? season.id : null,
        crop,
        quantity: data.quantity,
        countyCode: county ? county.code : undefined,
        observations: `${USSD_TAG}.`,
        now: ctx.now,
      }),
      id: stableId(ctx, 'harvest'),
    });
    return `Harvest saved!\n${crop.name}: ${fmtNum(harvest.quantity)} ${harvest.unit}\nRef: ${harvest.batch_reference}`;
  },

  async save_expense(data, ctx, { repo }) {
    const cat = expenseCategory(data);
    const farm = farmById(ctx, data.farmId);
    await repo.createExpense({
      ...shared.buildExpenseRecord({
        farmId: farm.id,
        category: cat.category,
        amount: data.amount,
        currency: 'USD',
        description: `${cat.label} expense. ${USSD_TAG}.`,
        now: ctx.now,
      }),
      id: stableId(ctx, 'expense'),
    });
    return `Expense saved!\n${cat.label}: $${fmtNum(data.amount)}\nFarm: ${short(farm.name, 30)}`;
  },

  async summary(data, ctx) {
    const year = ctx.now.getFullYear();
    await ensureRecords(ctx, ['harvests', 'expenses']);
    const s = shared.summarizeSeason({ harvests: ctx.records.harvests, expenses: ctx.records.expenses, year });
    const title = ctx.farms.length === 1 ? short(ctx.farms[0].name, 24) : `${ctx.farms.length} farms`;

    if (s.harvestCount === 0 && s.expenseCount === 0) {
      return `${year}: ${title}\nNo harvests or expenses yet.\nDial ${ctx.serviceCode} to record them.`;
    }
    const lines = [`${year}: ${title}`];
    if (s.byCrop.length === 0) lines.push('Harvest: none yet');
    s.byCrop.slice(0, 3).forEach((c) => lines.push(`${short(c.name, 12)}: ${fmtNum(c.quantity)} ${c.unit}`));
    if (s.byCrop.length > 3) lines.push(`+${s.byCrop.length - 3} more crops`);
    lines.push(`Expenses: ${fmtUsd(s.totalExpenses)}`);
    lines.push(`Est. sales: ${fmtUsd(s.estimatedRevenue)}`);
    lines.push(`Net: ${s.net < 0 ? '-' : '+'}${fmtUsd(Math.abs(s.net))}`);
    return lines.join('\n');
  },

  async weather(data, ctx, { weather }) {
    const days = weather ? await weather.getForecast(data.county) : null;
    if (!days || days.length === 0) return 'Weather is not available right now. Please try again later.';
    const lines = days.map(
      (d) => `${d.day}: ${d.label} ${d.tMin}-${d.tMax}C${d.rainChance != null ? `, rain ${d.rainChance}%` : ''}`
    );
    return `${data.county} weather:\n${lines.join('\n')}`;
  },
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
/**
 * @param {{sessionId?: string, serviceCode?: string, phoneNumber: string, text?: string}} req
 * @param {{repo: object, weather?: object, now?: () => Date}} deps
 * @returns {Promise<string>} "CON ..." or "END ..."
 */
async function handleUssd(req, deps) {
  const { sessionId, serviceCode, phoneNumber, text } = req || {};
  try {
    if (!phoneNumber || shared.normalizePhone(phoneNumber).length < 7) return 'END Invalid phone number.';

    const farmer = await deps.repo.findFarmerByPhone(phoneNumber);
    const farms = farmer ? await deps.repo.getFarms(farmer.id) : [];
    const ctx = {
      phone: phoneNumber,
      farmer,
      farms,
      sessionId: sessionId || null,
      serviceCode: serviceCode || '*000#',
      now: deps.now ? deps.now() : new Date(),
      repo: deps.repo,
      records: {},
    };

    let inputs = parseInputs(text);

    // ---- security: accounts have a PIN, checked here before any screen is shown --------------------------------
    if (deps.pins && deps.repo.pinsAvailable) {
      if (!(await deps.repo.pinsAvailable())) {
        // PIN storage is not ready: nobody can create an account without one. Existing farmers carry on as before.
        if (!farmer) return 'END The account service is being updated. Please try again later.';
      } else {
        ctx.pins = true;
        if (farmer) {
          const cred = await deps.repo.getPin(farmer.id);
          if (!cred) {
            ctx.needsPin = true; // chooses a PIN first
          } else {
            const locked = lockMinutesLeft(cred, ctx.now);
            if (locked) return `END Too many wrong PINs.\nTry again in ${locked} min.`;
            if (inputs.length === 0 || !PIN_PATTERN.test(inputs[0])) {
              return `CON FarmTori - Hi ${firstName(farmer.full_name)}\n${inputs.length ? 'Enter 4 digits.\n' : ''}Enter your 4-digit PIN:`;
            }
            if (!verifyPin(inputs[0], cred.pin_hash)) {
              const { attempts, lockedUntil } = await deps.repo.recordPinFailure(farmer.id, ctx.now);
              if (lockedUntil) return `END Wrong PIN.\nYour account is locked for ${LOCK_MINUTES} minutes.`;
              const left = Math.max(0, MAX_ATTEMPTS - attempts);
              return `END Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.`;
            }
            if (cred.failed_attempts > 0 || cred.locked_until) await deps.repo.clearPinFailures(farmer.id, ctx.now);
            inputs = inputs.slice(1); // the PIN is not part of the screens
          }
        }
      }
    }

    const result = await replay(inputs, ctx);

    if (result.end) {
      ctx.consumedText = inputs.slice(0, result.consumed).join('*');
      const message = await ACTIONS[result.end](result.data, ctx, deps);
      return `END ${clamp(message)}`;
    }

    const { state, depth } = result;
    await ensureRecords(ctx, SCREENS[state.screen].needs);
    const prompt = SCREENS[state.screen].prompt(ctx, state.data);
    return `CON ${composeScreen(prompt, state.error, depth > 0)}`;
  } catch (e) {
    console.error('[ussd] handler error:', e);
    return `END ${BUSY_MESSAGE}`;
  }
}

module.exports = {
  handleUssd,
  MAX_SCREEN_CHARS,
  NAV_FOOTER,
  BUSY_MESSAGE,
  // exported for tests
  _internal: { parseInputs, parseAmount, parseName, replay, SCREENS },
};
