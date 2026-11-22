const test = require('node:test');
const assert = require('node:assert/strict');

const W = require('../src/shared/seasonWeather');
const { WEATHER_THRESHOLDS: T } = W;

// ---------------------------------------------------------------------------
// Fixture with hand-worked answers.
// Window: planting 2026-05-01, so the window starts 2026-04-01 (30 days before).
// Data through 2026-07-09 = 100 days (index 0 = Apr 1, 30 = May 1, 61 = Jun 1, 91 = Jul 1).
// Wet days (everything else is 0 mm):
//   Apr 11 25 | Apr 25 3 | May 7 12 | May 8 60 | May 20 2 | Jun 12 5 | Jul 8 55
// ---------------------------------------------------------------------------
const PLANTING = '2026-05-01';
const WINDOW = { planting: PLANTING, start: '2026-04-01', dataEnd: '2026-07-09' };
const WET = { '2026-04-11': 25, '2026-04-25': 3, '2026-05-07': 12, '2026-05-08': 60, '2026-05-20': 2, '2026-06-12': 5, '2026-07-08': 55 };

function daily(start, end, rainOf = (d) => WET[d] ?? 0) {
  const rows = [];
  let i = 0;
  for (let d = start; d <= end; d = W.addDays(d, 1), i++) {
    rows.push({ date: d, rain: rainOf(d, i), tmax: i % 2 ? 32 : 30, tmin: i % 2 ? 24 : 22 });
  }
  return rows;
}

test('named thresholds match the spec', () => {
  assert.deepEqual({ ...T }, {
    RAINY_DAY_MM: 1, HEAVY_RAIN_DAY_MM: 50, RAINS_START_DAYS: 3, RAINS_START_MM: 20, DAYS_BEFORE_PLANTING: 30,
    FIRST_RAIN_DAYS: 30, FIRST_DRY_SPELL_DAYS: 60, COORD_DECIMALS: 2, ARCHIVE_LAG_DAYS: 5, REFRESH_HOURS: 24,
  });
  assert.ok(Object.isFrozen(T));
});

test('summary: every measure matches the hand-worked answer', () => {
  const s = W.summarizeWeather(daily(WINDOW.start, WINDOW.dataEnd), WINDOW);
  assert.equal(s.days_expected, 100);
  assert.equal(s.days_with_data, 100);
  assert.equal(s.total_rain_mm, 162);
  assert.equal(s.rainy_days, 7);
  assert.equal(s.heavy_rain_days, 2);
  assert.equal(s.longest_dry_spell_days, 25); // Jun 13 .. Jul 7
  assert.equal(s.avg_tmax_c, 31);
  assert.equal(s.avg_tmin_c, 23);
  assert.equal(s.rain_first_30d_mm, 74); // May 2..31: 12 + 60 + 2 (planting day itself is day 0)
  assert.equal(s.first30_complete, true);
  assert.equal(s.longest_dry_spell_first_60d_days, 22); // May 21 .. Jun 11, inside days 1..60
  assert.equal(s.first60_complete, true);
  assert.equal(s.rains_start_date, '2026-04-11');
  assert.equal(s.rains_start_days_from_planting, -20);
  assert.deepEqual(s.monthly, {
    '2026-04': { rain_mm: 28, rainy_days: 2, days: 30 },
    '2026-05': { rain_mm: 74, rainy_days: 3, days: 31 },
    '2026-06': { rain_mm: 5, rainy_days: 1, days: 30 },
    '2026-07': { rain_mm: 55, rainy_days: 1, days: 9 },
  });
});

test('summary: a 1 mm day is rainy, 0.9 mm is dry; 50 mm is heavy, 49.9 is not', () => {
  const rows = daily('2026-04-01', '2026-04-10', (d) => ({ '2026-04-03': 1, '2026-04-05': 0.9, '2026-04-07': 50, '2026-04-09': 49.9 }[d] ?? 0));
  const s = W.summarizeWeather(rows, { planting: '2026-05-01', start: '2026-04-01', dataEnd: '2026-04-10' });
  assert.equal(s.rainy_days, 3); // 1, 50, 49.9
  assert.equal(s.heavy_rain_days, 1);
  assert.equal(s.longest_dry_spell_days, 3); // Apr 4, 5, 6 (the 0.9 mm day counts as dry); Apr 1-2 is only 2 days
});

test('start of the rains: first 3-day period with >= 20 mm, reported from its first wet day', () => {
  const w = { planting: '2026-05-01', start: '2026-04-01', dataEnd: '2026-04-20' };
  const run = (m) => W.summarizeWeather(daily(w.start, w.dataEnd, (d) => m[d] ?? 0), w);
  assert.equal(run({ '2026-04-05': 10, '2026-04-06': 10 }).rains_start_date, '2026-04-05'); // 10+10+0 = 20
  assert.equal(run({ '2026-04-05': 10, '2026-04-06': 9.9 }).rains_start_date, null); // 19.9 is not enough
  assert.equal(run({ '2026-04-05': 10, '2026-04-07': 10 }).rains_start_date, '2026-04-05'); // 10+0+10 inside 3 days
  assert.equal(run({ '2026-04-05': 10, '2026-04-08': 10 }).rains_start_date, null); // 4 days apart: not one period
  assert.equal(run({ '2026-04-09': 22 }).rains_start_date, '2026-04-09'); // dry, dry, 22 -> the day it rained
  assert.equal(run({}).rains_start_date, null);
  assert.equal(run({}).rains_start_days_from_planting, null);
});

test('missing archive values never invent rain or a dry spell', () => {
  const rows = daily(WINDOW.start, WINDOW.dataEnd).map((r) => (r.date === '2026-05-21' ? { ...r, rain: null, tmax: null, tmin: null } : r));
  const s = W.summarizeWeather(rows, WINDOW);
  assert.equal(s.days_with_data, 99);
  assert.equal(s.total_rain_mm, 162);
  assert.equal(s.longest_dry_spell_first_60d_days, 21, 'the gap splits the 22-day spell');
  assert.equal(s.first60_complete, false);
  assert.equal(s.first30_complete, false, 'May 21 is inside days 1..30');
  // rows missing entirely behave the same as nulls
  const gap = daily(WINDOW.start, WINDOW.dataEnd).filter((r) => r.date !== '2026-05-21');
  assert.deepEqual(W.summarizeWeather(gap, WINDOW), s);
});

test('summary of a season still early: first-30 and first-60 measures are flagged incomplete', () => {
  const w = { planting: PLANTING, start: '2026-04-01', dataEnd: '2026-05-11' }; // 10 days after planting
  const s = W.summarizeWeather(daily(w.start, w.dataEnd), w);
  assert.equal(s.rain_first_30d_mm, 72); // May 7 12 + May 8 60 so far
  assert.equal(s.first30_complete, false);
  assert.equal(s.first60_complete, false);
  assert.equal(s.longest_dry_spell_first_60d_days, 5); // May 2..6
  const none = W.summarizeWeather(daily('2026-04-01', '2026-04-20'), { planting: PLANTING, start: '2026-04-01', dataEnd: '2026-04-20' });
  assert.equal(none.rain_first_30d_mm, null, 'no days after planting yet');
  assert.equal(none.longest_dry_spell_first_60d_days, null);
});

test('summary matches an independent brute-force check on random weather', () => {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let round = 0; round < 25; round++) {
    const start = '2025-12-15';
    const end = W.addDays(start, 150 + Math.floor(rnd() * 100));
    const planting = W.addDays(start, 30);
    const rows = daily(start, end, () => (rnd() < 0.45 ? 0 : Math.round(rnd() * rnd() * 90 * 10) / 10));
    const s = W.summarizeWeather(rows, { planting, start, dataEnd: end });

    // naive: one character per day, then regex for the runs
    const sym = rows.map((r) => (r.rain >= 1 ? 'w' : 'd')).join('');
    const longest = (str) => Math.max(0, ...(str.match(/d+/g) || []).map((x) => x.length));
    assert.equal(s.longest_dry_spell_days, longest(sym), `round ${round} dry spell`);
    assert.equal(s.rainy_days, (sym.match(/w/g) || []).length);
    assert.equal(s.heavy_rain_days, rows.filter((r) => r.rain >= 50).length);
    assert.equal(s.total_rain_mm, Math.round(rows.reduce((a, r) => a + r.rain, 0) * 10) / 10);
    // days 1..60 after planting are characters 31..90 of the string
    assert.equal(s.longest_dry_spell_first_60d_days, longest(sym.slice(31, 91)), `round ${round} first 60`);
    assert.equal(s.rain_first_30d_mm, Math.round(rows.slice(31, 61).reduce((a, r) => a + r.rain, 0) * 10) / 10);
    const monthTotal = Object.values(s.monthly).reduce((a, m) => a + m.rain_mm, 0);
    assert.ok(Math.abs(monthTotal - s.total_rain_mm) < 0.5, 'months add up to the total');
    // onset: brute force over all start days
    let onset = null;
    for (let i = 0; i + 3 <= rows.length && !onset; i++) {
      if (rows[i].rain + rows[i + 1].rain + rows[i + 2].rain >= 20) onset = [rows[i], rows[i + 1], rows[i + 2]].find((r) => r.rain >= 1).date;
    }
    assert.equal(s.rains_start_date, onset, `round ${round} onset`);
  }
});

// ---------------------------------------------------------------------------
// Window: planting date, season end, lag, coordinates
// ---------------------------------------------------------------------------
test('planting date: earliest "Planting" activity of this season, else the season date', () => {
  const season = { id: 's1', planting_date: '2026-05-10' };
  const acts = [
    { season_id: 's1', activity_type: 'Weeding', activity_date: '2026-04-01' }, // not planting
    { season_id: 's2', activity_type: 'Planting', activity_date: '2026-03-01' }, // another season
    { season_id: 's1', activity_type: 'planting ', activity_date: '2026-05-04' },
    { season_id: 's1', activity_type: 'Planting', activity_date: '2026-05-02' },
  ];
  assert.equal(W.plantingDateOf(season, acts), '2026-05-02');
  assert.equal(W.plantingDateOf(season, acts.slice(0, 2)), '2026-05-10');
  assert.equal(W.plantingDateOf({ id: 's1', start_date: '2026-06-01' }, []), '2026-06-01');
  assert.equal(W.plantingDateOf({ id: 's1' }, []), null);
});

test('season end: last harvest date (never in the future), else today', () => {
  const now = new Date('2026-09-30T10:00:00Z');
  const season = { id: 's1' };
  assert.deepEqual(W.seasonEndOf(season, [], now), { end: '2026-09-30', hasHarvest: false });
  const hs = [
    { season_id: 's1', harvest_date: '2026-08-15' },
    { season_id: 's1', harvest_date: '2026-09-02' },
    { season_id: 's2', harvest_date: '2026-09-20' },
    { season_id: 's1', harvest_date: '2026-09-25', deleted_at: '2026-09-26' },
  ];
  assert.deepEqual(W.seasonEndOf(season, hs, now), { end: '2026-09-02', hasHarvest: true });
  assert.equal(W.seasonEndOf(season, [{ season_id: 's1', harvest_date: '2027-01-01' }], now).end, '2026-09-30');
});

test('window: 30 days before planting to season end, with running / partial flags', () => {
  const now = new Date('2026-09-30T10:00:00Z');
  const season = { id: 's1', planting_date: '2026-05-01', status: 'active' };
  const running = W.weatherWindow({ season, now });
  assert.equal(running.start, '2026-04-01');
  assert.equal(running.end, '2026-09-30');
  assert.equal(running.dataEnd, '2026-09-25', 'the newest 5 days are not in the archive yet');
  assert.equal(running.running, true);
  assert.equal(running.partial, true);

  const finished = W.weatherWindow({ season, harvests: [{ season_id: 's1', harvest_date: '2026-08-20' }], now });
  assert.equal(finished.end, '2026-08-20');
  assert.equal(finished.dataEnd, '2026-08-20');
  assert.equal(finished.running, false);
  assert.equal(finished.partial, false);

  const justEnded = W.weatherWindow({ season, harvests: [{ season_id: 's1', harvest_date: '2026-09-28' }], now });
  assert.equal(justEnded.running, false);
  assert.equal(justEnded.partial, true, 'finished, but the last days are not available yet');
  assert.equal(W.weatherWindow({ season: { ...season, status: 'harvesting' }, harvests: [{ season_id: 's1', harvest_date: '2026-08-20' }], now }).running, true);

  const future = W.weatherWindow({ season: { id: 's9', planting_date: '2026-12-01' }, now });
  assert.equal(future.hasData, false, 'not planted yet: nothing to record');
  assert.equal(W.weatherWindow({ season: { id: 'x' }, now }), null);
});

test('coordinates are rounded to 2 decimals before anything is sent', async () => {
  assert.equal(W.roundCoord(6.4281), 6.43);
  assert.equal(W.roundCoord(-9.4295), -9.43);
  assert.equal(W.roundCoord(7.0049), 7);
  const url = W.buildArchiveUrl({ latitude: 6.428123, longitude: -9.429567, start: '2026-04-01', end: '2026-07-09' });
  assert.match(url, /^https:\/\/archive-api\.open-meteo\.com\/v1\/archive\?/);
  assert.match(url, /latitude=6\.43&longitude=-9\.43/);
  assert.doesNotMatch(url, /6\.428|9\.4295/);
  assert.match(url, /start_date=2026-04-01&end_date=2026-07-09/);
  assert.match(url, /daily=precipitation_sum%2Ctemperature_2m_max%2Ctemperature_2m_min/);
  assert.match(url, /timezone=auto/);

  let sentUrl = '';
  const rows = await W.fetchDailyWeather({
    latitude: 6.428123, longitude: -9.429567, start: '2026-04-01', end: '2026-04-03',
    fetchImpl: async (u) => {
      sentUrl = u;
      return { ok: true, json: async () => ({ daily: { time: ['2026-04-01', '2026-04-02', '2026-04-03'], precipitation_sum: [0, null, 12.5], temperature_2m_max: [30, 31, 29], temperature_2m_min: [22, 23, null] } }) };
    },
  });
  assert.match(sentUrl, /latitude=6\.43/);
  assert.deepEqual(rows[1], { date: '2026-04-02', rain: null, tmax: 31, tmin: 23 });
  assert.deepEqual(rows[2], { date: '2026-04-03', rain: 12.5, tmax: 29, tmin: null });
  await assert.rejects(() => W.fetchDailyWeather({ latitude: 1, longitude: 1, start: 'a', end: 'b', fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
  await assert.rejects(() => W.fetchDailyWeather({ latitude: 1, longitude: 1, start: 'a', end: 'b', fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), /no daily data/);
});

test('the stored season record has the summary but no daily rows', () => {
  const now = new Date('2026-09-30T10:00:00Z');
  const season = { id: 's1', planting_date: PLANTING };
  const window = { planting: PLANTING, start: '2026-04-01', end: '2026-07-09', dataEnd: '2026-07-09', running: false, partial: false };
  const rec = W.buildSeasonWeather({ season, window, daily: daily(window.start, window.dataEnd), latitude: 6.428123, longitude: -9.429567, now });
  assert.equal(rec.season_id, 's1');
  assert.equal(rec.latitude, 6.43);
  assert.equal(rec.longitude, -9.43);
  assert.equal(rec.total_rain_mm, 162);
  assert.equal(rec.data_through, '2026-07-09');
  assert.equal(rec.computed_at, now.toISOString());
  assert.ok(!('daily' in rec) && !Object.values(rec).some((v) => Array.isArray(v)), 'no daily rows travel with the summary');
  const rows = W.dailyRowsFor('s1', daily('2026-03-01', '2026-07-20'), window);
  assert.equal(rows.length, 100, 'daily rows (server side only) are clipped to the window');
  assert.deepEqual(Object.keys(rows[0]).sort(), ['date', 'rain_mm', 'season_id', 'tmax_c', 'tmin_c']);
});

test('refresh: finished seasons are computed once, running ones at most daily', () => {
  const now = new Date('2026-09-30T10:00:00Z');
  const done = { planting: PLANTING, end: '2026-08-20', dataEnd: '2026-08-20', partial: false };
  const stored = { planting_date: PLANTING, window_end: '2026-08-20', data_through: '2026-08-20', computed_at: '2026-09-01T00:00:00Z' };
  assert.equal(W.needsRefresh(null, done, now), true);
  assert.equal(W.needsRefresh(stored, done, now), false, 'finished and complete: never again');
  assert.equal(W.needsRefresh({ ...stored, planting_date: '2026-05-05' }, done, now), true, 'planting date changed');
  assert.equal(W.needsRefresh(stored, { ...done, end: '2026-08-25', dataEnd: '2026-08-25' }, now), true, 'a later harvest was recorded');

  const run = { planting: PLANTING, end: '2026-09-30', dataEnd: '2026-09-25', partial: true };
  const runStored = { planting_date: PLANTING, window_end: '2026-09-30', data_through: '2026-09-25', computed_at: '2026-09-30T02:00:00Z' };
  assert.equal(W.needsRefresh(runStored, run, now), false, 'refreshed 8 hours ago');
  assert.equal(W.needsRefresh({ ...runStored, computed_at: '2026-09-29T02:00:00Z' }, run, now), true, 'older than 24 hours');
  assert.equal(W.needsRefresh({ ...runStored, window_end: '2026-09-29', data_through: '2026-09-24' }, run, now), true);
});

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------
const weatherOf = (over) => ({
  planting_date: '2026-05-01', data_through: '2026-09-25', running: false, partial: false, days_expected: 148,
  rain_first_30d_mm: 100, first30_complete: true, longest_dry_spell_first_60d_days: 9, first60_complete: true,
  rains_start_date: '2026-04-20', rains_start_days_from_planting: -11, total_rain_mm: 900, rainy_days: 80, heavy_rain_days: 3, ...over,
});
const item = (id, over = {}, w = {}) => ({ id, name: id, crop_id: 'rice', crop_name: 'Rice', planting_date: '2026-05-01', weather: weatherOf(w), ...over });

test('comparison: only seasons of the same crop, at least two, all with weather', () => {
  assert.equal(W.compareSeasons([item('a')]).reason, 'need_two');
  const mixed = W.compareSeasons([item('a'), item('b', { crop_id: 'cassava', crop_name: 'Cassava' })]);
  assert.equal(mixed.ok, false);
  assert.equal(mixed.reason, 'different_crops');
  assert.match(mixed.message, /same crop/);
  const none = W.compareSeasons([item('a'), item('b', { weather: null })]);
  assert.equal(none.reason, 'no_weather');
  assert.deepEqual(none.missing, ['b']);
});

test('comparison: seasons are lined up by days since planting and sorted by planting date', () => {
  const r = W.compareSeasons([
    item('2026', { planting_date: '2026-05-01' }, { planting_date: '2026-05-01', data_through: '2026-09-25' }),
    item('2025', { planting_date: '2025-06-15' }, { planting_date: '2025-06-15', data_through: '2025-10-30', rain_first_30d_mm: 140 }),
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows.map((x) => x.name), ['2025', '2026']);
  assert.equal(r.rows[0].rain_first_30d_mm, 140);
  assert.equal(r.rows[0].rains_start_days_from_planting, -11, 'start of the rains is relative to planting, not a calendar date');
  assert.equal(r.rows[1].days_after_planting_covered, 147); // May 1 -> Sep 25
  assert.equal(r.rows[0].days_after_planting_covered, 137); // Jun 15 -> Oct 30
  assert.equal(r.commonDaysAfterPlanting, 137);
  assert.equal(r.fair.first30, true);
  assert.deepEqual(r.notes, []);
});

test('comparison: a season still running is always called "season still running"', () => {
  const r = W.compareSeasons([
    item('2025'),
    item('2026', {}, { running: true, partial: true, first60_complete: false, longest_dry_spell_first_60d_days: 4 }),
  ]);
  assert.equal(r.ok, true);
  assert.ok(r.notes.includes('2026: season still running'));
  assert.equal(r.mixedCompleteness, true);
  assert.ok(r.notes.some((n) => /still running is being compared with finished seasons/.test(n)));
  assert.equal(r.fair.first60, false, 'the 60-day measure is not like for like');
  assert.equal(r.fair.first30, true);
  assert.equal(r.fair.totals, false);
  // two running seasons: each is labelled, but it is not a running-vs-finished comparison
  const both = W.compareSeasons([item('a', {}, { running: true, partial: true }), item('b', {}, { running: true, partial: true })]);
  assert.deepEqual(both.notes, ['a: season still running', 'b: season still running']);
  assert.equal(both.mixedCompleteness, false);
  // finished but newest days missing from the archive
  const lag = W.compareSeasons([item('a'), item('b', {}, { partial: true })]);
  assert.ok(lag.notes.includes('b: the latest days are not available yet'));
});

test('comparison: whole-season totals are only like-for-like over the same number of days', () => {
  assert.equal(W.compareSeasons([item('a'), item('b')]).fair.totals, true);
  assert.equal(W.compareSeasons([item('a'), item('b', {}, { days_expected: 120 })]).fair.totals, false);
});
