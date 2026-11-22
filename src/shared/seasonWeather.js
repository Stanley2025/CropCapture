'use strict';
/**
 * Season weather: recorded quietly per season and shown ONLY inside the season record and
 * the season comparison. No forecast, alert or advice is produced here.
 *
 * Pure functions (no React, no storage) so they run in the app and in node:test.
 *
 * Window: 30 days BEFORE planting (captures the start of the rains) to season end.
 *   planting = earliest "Planting" activity of the season, else the season's planting_date
 *   end      = last harvest date of the season (never in the future), else today
 * Data: daily rain (mm), max and min temperature from the Open-Meteo historical archive,
 *   for the farm's GPS point rounded to 2 decimals (about 1 km) before it is sent.
 */

const { stableRowId } = require('./seasonRecord');
const { PLANTING_ACTIVITIES } = require('./activityTypes');
const PLANTING_SET = new Set(PLANTING_ACTIVITIES.map((t) => t.toLowerCase()));

// ---------------------------------------------------------------------------
// Named thresholds: local agronomists can adjust these in one place.
// ---------------------------------------------------------------------------
const WEATHER_THRESHOLDS = Object.freeze({
  /** A day with at least this much rain (mm) is a rainy day. Less than this is a dry day. */
  RAINY_DAY_MM: 1,
  /** A day with at least this much rain (mm) is a heavy-rain day (flood-risk marker). */
  HEAVY_RAIN_DAY_MM: 50,
  /** "Start of the rains": the first run of this many days ... */
  RAINS_START_DAYS: 3,
  /** ... whose total rain is at least this many mm. */
  RAINS_START_MM: 20,
  /** Days of weather recorded before planting. */
  DAYS_BEFORE_PLANTING: 30,
  /** "Rain in the first N days after planting" (days 1..N, planting day is day 0). */
  FIRST_RAIN_DAYS: 30,
  /** "Longest dry spell in the first N days after planting" (days 1..N). */
  FIRST_DRY_SPELL_DAYS: 60,
  /** GPS coordinates are rounded to this many decimals before sending (2 = about 1 km). */
  COORD_DECIMALS: 2,
  /** The archive trails real time; the newest days are not available yet. */
  ARCHIVE_LAG_DAYS: 5,
  /** A running season's weather is refreshed at most this often. */
  REFRESH_HOURS: 24,
});

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const DAILY_VARIABLES = 'precipitation_sum,temperature_2m_max,temperature_2m_min';

// ---------------------------------------------------------------------------
// Dates (ISO YYYY-MM-DD, UTC; Liberia is on GMT so local dates match)
// ---------------------------------------------------------------------------
const DAY_MS = 86400000;
const utc = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (iso, n) => isoOf(utc(iso) + n * DAY_MS);
const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / DAY_MS);
const todayOf = (now = new Date()) => now.toISOString().slice(0, 10);
const isIsoDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s);
const minDate = (a, b) => (a <= b ? a : b);
const round1 = (n) => Math.round(n * 10) / 10;

function roundCoord(value, decimals = WEATHER_THRESHOLDS.COORD_DECIMALS) {
  const f = 10 ** decimals;
  return Math.round(Number(value) * f) / f;
}

// ---------------------------------------------------------------------------
// Which dates the window covers
// ---------------------------------------------------------------------------
/**
 * Earliest planting activity of the season (sowing, transplanting, broadcasting, drilling, direct
 * planting, or the older plain "Planting"), else the season's planting date. Preparing seed
 * (selection, sorting, treatment) is not planting.
 */
function plantingDateOf(season, activities = []) {
  const isPlanting = (type) => PLANTING_SET.has(String(type || '').trim().toLowerCase());
  const planted = activities
    .filter((a) => a && a.season_id === season.id && isPlanting(a.activity_type) && isIsoDate(a.activity_date))
    .map((a) => a.activity_date.slice(0, 10))
    .sort();
  if (planted.length) return planted[0];
  const fallback = season.planting_date || season.start_date;
  return isIsoDate(fallback) ? fallback.slice(0, 10) : null;
}

/** Season end = last harvest date (never after today), else today. */
function seasonEndOf(season, harvests = [], now = new Date()) {
  const today = todayOf(now);
  const dates = harvests
    .filter((h) => h && h.season_id === season.id && !h.deleted_at && isIsoDate(h.harvest_date))
    .map((h) => h.harvest_date.slice(0, 10))
    .sort();
  if (!dates.length) return { end: today, hasHarvest: false };
  return { end: minDate(dates[dates.length - 1], today), hasHarvest: true };
}

/**
 * The dates to record. `running` is true while no harvest is recorded or the season is
 * marked "harvesting". `partial` also covers the archive lag (newest days not available yet).
 */
function weatherWindow({ season, activities = [], harvests = [], now = new Date() }) {
  const T = WEATHER_THRESHOLDS;
  const planting = plantingDateOf(season, activities);
  if (!planting) return null;
  const { end, hasHarvest } = seasonEndOf(season, harvests, now);
  const start = addDays(planting, -T.DAYS_BEFORE_PLANTING);
  const available = addDays(todayOf(now), -T.ARCHIVE_LAG_DAYS);
  const dataEnd = minDate(end, available);
  const running = !hasHarvest || season.status === 'harvesting';
  return {
    planting,
    start,
    end,
    dataEnd,
    running,
    partial: running || dataEnd < end,
    hasData: dataEnd >= start,
  };
}

// ---------------------------------------------------------------------------
// Open-Meteo archive
// ---------------------------------------------------------------------------
function buildArchiveUrl({ latitude, longitude, start, end, baseUrl = ARCHIVE_URL }) {
  const params = new URLSearchParams({
    latitude: String(roundCoord(latitude)),
    longitude: String(roundCoord(longitude)),
    start_date: start,
    end_date: end,
    daily: DAILY_VARIABLES,
    timezone: 'auto',
  });
  return `${baseUrl}?${params}`;
}

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** API response -> [{date, rain, tmax, tmin}] (null where the archive has no value). */
function parseArchiveResponse(json) {
  const d = json && json.daily;
  if (!d || !Array.isArray(d.time)) throw new Error('Open-Meteo archive: no daily data');
  return d.time.map((date, i) => ({
    date,
    rain: num(d.precipitation_sum && d.precipitation_sum[i]),
    tmax: num(d.temperature_2m_max && d.temperature_2m_max[i]),
    tmin: num(d.temperature_2m_min && d.temperature_2m_min[i]),
  }));
}

async function fetchDailyWeather({ fetchImpl = globalThis.fetch, latitude, longitude, start, end, timeoutMs = 15000 }) {
  const url = buildArchiveUrl({ latitude, longitude, start, end });
  const opts = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(timeoutMs) } : {};
  const res = await fetchImpl(url, opts);
  if (!res.ok) throw new Error(`Open-Meteo archive HTTP ${res.status}`);
  return parseArchiveResponse(await res.json());
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
/**
 * Summarise daily rows. A missing value breaks a dry spell and is excluded from totals,
 * so a gap in the data can never invent a long dry spell or extra rain.
 *
 * @param daily  [{date, rain, tmax, tmin}]
 * @param window {planting, start, dataEnd}
 */
function summarizeWeather(daily, window, thresholds = WEATHER_THRESHOLDS) {
  const T = thresholds;
  const byDate = new Map();
  for (const row of daily || []) if (row && isIsoDate(row.date)) byDate.set(row.date.slice(0, 10), row);

  const dates = [];
  for (let d = window.start; d <= window.dataEnd; d = addDays(d, 1)) dates.push(d);
  const rainOf = (d) => (byDate.has(d) ? num(byDate.get(d).rain) : null);

  let totalRain = 0;
  let rainyDays = 0;
  let heavyDays = 0;
  let daysWithRain = 0;
  let spell = 0;
  let longestSpell = 0;
  const tmax = [];
  const tmin = [];
  const monthly = {};

  for (const d of dates) {
    const row = byDate.get(d);
    const rain = rainOf(d);
    if (row && num(row.tmax) !== null) tmax.push(num(row.tmax));
    if (row && num(row.tmin) !== null) tmin.push(num(row.tmin));
    if (rain === null) {
      spell = 0;
      continue;
    }
    daysWithRain++;
    totalRain += rain;
    const month = d.slice(0, 7);
    const m = monthly[month] || (monthly[month] = { rain_mm: 0, rainy_days: 0, days: 0 });
    m.rain_mm += rain;
    m.days++;
    if (rain >= T.RAINY_DAY_MM) {
      rainyDays++;
      m.rainy_days++;
      spell = 0;
    } else {
      spell++;
      if (spell > longestSpell) longestSpell = spell;
    }
    if (rain >= T.HEAVY_RAIN_DAY_MM) heavyDays++;
  }
  for (const m of Object.values(monthly)) m.rain_mm = round1(m.rain_mm);

  // Start of the rains: first run of RAINS_START_DAYS consecutive days with >= RAINS_START_MM.
  let rainsStart = null;
  for (let i = 0; i + T.RAINS_START_DAYS <= dates.length; i++) {
    let sum = 0;
    let complete = true;
    for (let k = 0; k < T.RAINS_START_DAYS; k++) {
      const r = rainOf(dates[i + k]);
      if (r === null) { complete = false; break; }
      sum += r;
    }
    if (complete && sum >= T.RAINS_START_MM) {
      // The period is chosen exactly as specified; the date reported is the first wet day in it,
      // so "dry, dry, 25 mm" is dated to the day the rain fell, not two days earlier.
      for (let k = 0; k < T.RAINS_START_DAYS; k++) {
        if (rainOf(dates[i + k]) >= T.RAINY_DAY_MM) { rainsStart = dates[i + k]; break; }
      }
      break;
    }
  }

  // Measures counted in days after planting (planting day = day 0).
  const after = (fromDay, toDay) => {
    const first = addDays(window.planting, fromDay);
    const last = addDays(window.planting, toDay);
    const upto = minDate(last, window.dataEnd);
    let rain = 0;
    let have = 0;
    let missing = 0;
    let s = 0;
    let longest = 0;
    for (let d = first; d <= upto; d = addDays(d, 1)) {
      const r = rainOf(d);
      if (r === null) { missing++; s = 0; continue; }
      have++;
      rain += r;
      if (r < T.RAINY_DAY_MM) { s++; if (s > longest) longest = s; } else s = 0;
    }
    const expected = toDay - fromDay + 1;
    return { rain, longest, have, complete: have === expected && window.dataEnd >= last, any: have > 0 };
  };
  const first30 = after(1, T.FIRST_RAIN_DAYS);
  const first60 = after(1, T.FIRST_DRY_SPELL_DAYS);

  const avg = (a) => (a.length ? round1(a.reduce((x, y) => x + y, 0) / a.length) : null);
  return {
    days_expected: dates.length,
    days_with_data: daysWithRain,
    total_rain_mm: round1(totalRain),
    rainy_days: rainyDays,
    longest_dry_spell_days: longestSpell,
    avg_tmax_c: avg(tmax),
    avg_tmin_c: avg(tmin),
    rain_first_30d_mm: first30.any ? round1(first30.rain) : null,
    first30_complete: first30.complete,
    longest_dry_spell_first_60d_days: first60.any ? first60.longest : null,
    first60_complete: first60.complete,
    rains_start_date: rainsStart,
    rains_start_days_from_planting: rainsStart ? daysBetween(window.planting, rainsStart) : null,
    heavy_rain_days: heavyDays,
    monthly,
  };
}

/** The record stored per season (no daily rows). */
function buildSeasonWeather({ season, window, daily, latitude, longitude, now = new Date(), idFactory }) {
  const summary = summarizeWeather(daily, window);
  return {
    id: idFactory ? idFactory() : stableRowId('weather', season.id),
    season_id: season.id,
    planting_date: window.planting,
    window_start: window.start,
    window_end: window.end,
    data_through: window.dataEnd,
    running: window.running,
    partial: window.partial,
    ...summary,
    latitude: roundCoord(latitude),
    longitude: roundCoord(longitude),
    source: 'open-meteo-archive',
    computed_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

/** Does a stored summary need recomputing? */
function needsRefresh(existing, window, now = new Date()) {
  if (!existing) return true;
  if (existing.planting_date !== window.planting) return true;
  if (existing.window_end !== window.end) return true;
  if (existing.data_through !== window.dataEnd) {
    // The archive has caught up only if there is newer data to fetch.
    return window.dataEnd > existing.data_through;
  }
  if (!window.partial) return false;
  const ageHours = (now.getTime() - new Date(existing.computed_at).getTime()) / 3600000;
  return !(ageHours < WEATHER_THRESHOLDS.REFRESH_HOURS);
}

/** Daily rows for the server-side table (not synced to phones). */
function dailyRowsFor(seasonId, daily, window) {
  return (daily || [])
    .filter((r) => r.date >= window.start && r.date <= window.dataEnd)
    .map((r) => ({ season_id: seasonId, date: r.date, rain_mm: r.rain, tmax_c: r.tmax, tmin_c: r.tmin }));
}

// ---------------------------------------------------------------------------
// Comparing seasons
// ---------------------------------------------------------------------------
const STILL_RUNNING = 'season still running';

/**
 * Compare seasons of ONE crop, lined up by days since planting (never by calendar month).
 * Phones hold only the summary, so the days-since-planting measures are the ones compared:
 * rain in the first 30 days, longest dry spell in the first 60 days, and the start of the
 * rains relative to the planting day. Whole-window totals are shown with the days they cover.
 *
 * items: [{id, name, crop_id, crop_name, planting_date, weather}]
 */
function compareSeasons(items) {
  const list = (items || []).filter(Boolean);
  if (list.length < 2) return { ok: false, reason: 'need_two', message: 'Pick at least two seasons to compare.' };
  const crops = new Set(list.map((i) => i.crop_id));
  if (crops.size > 1) {
    return { ok: false, reason: 'different_crops', message: 'Only seasons of the same crop can be compared.' };
  }
  const missing = list.filter((i) => !i.weather);
  if (missing.length) {
    return {
      ok: false,
      reason: 'no_weather',
      message: `No weather recorded yet for ${missing.map((m) => m.name).join(', ')}.`,
      missing: missing.map((m) => m.id),
    };
  }

  const rows = list
    .map((i) => {
      const w = i.weather;
      return {
        id: i.id,
        name: i.name,
        planting_date: i.planting_date || w.planting_date,
        running: Boolean(w.running),
        partial: Boolean(w.partial),
        days_after_planting_covered: Math.max(0, daysBetween(w.planting_date, w.data_through)),
        rain_first_30d_mm: w.rain_first_30d_mm,
        first30_complete: Boolean(w.first30_complete),
        longest_dry_spell_first_60d_days: w.longest_dry_spell_first_60d_days,
        first60_complete: Boolean(w.first60_complete),
        rains_start_days_from_planting: w.rains_start_days_from_planting,
        rains_start_date: w.rains_start_date,
        total_rain_mm: w.total_rain_mm,
        rainy_days: w.rainy_days,
        heavy_rain_days: w.heavy_rain_days,
        window_days: w.days_expected,
      };
    })
    .sort((a, b) => String(a.planting_date).localeCompare(String(b.planting_date)));

  const running = rows.filter((r) => r.running);
  const completed = rows.filter((r) => !r.running);
  const notes = running.map((r) => `${r.name}: ${STILL_RUNNING}`);
  const mixed = running.length > 0 && completed.length > 0;
  if (mixed) {
    notes.push(
      `A season still running is being compared with finished seasons. Only the measures marked complete cover the same days after planting.`
    );
  }
  const lagging = rows.filter((r) => !r.running && r.partial);
  for (const r of lagging) notes.push(`${r.name}: the latest days are not available yet`);

  return {
    ok: true,
    crop_id: list[0].crop_id,
    rows,
    notes,
    mixedCompleteness: mixed,
    /** True only when every season covers the whole measure, so the numbers are like for like. */
    fair: {
      first30: rows.every((r) => r.first30_complete),
      first60: rows.every((r) => r.first60_complete),
      totals: rows.every((r) => !r.partial) && new Set(rows.map((r) => r.window_days)).size === 1,
    },
    /** Days after planting that every season has data for. */
    commonDaysAfterPlanting: Math.min(...rows.map((r) => r.days_after_planting_covered)),
  };
}

module.exports = {
  WEATHER_THRESHOLDS,
  ARCHIVE_URL,
  STILL_RUNNING,
  addDays,
  daysBetween,
  todayOf,
  roundCoord,
  plantingDateOf,
  seasonEndOf,
  weatherWindow,
  buildArchiveUrl,
  parseArchiveResponse,
  fetchDailyWeather,
  summarizeWeather,
  buildSeasonWeather,
  needsRefresh,
  dailyRowsFor,
  compareSeasons,
};
