const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../src/shared/activityWeather');

// A record exactly as an older version of the app saved it: no weather fields at all.
const OLD = Object.freeze({
  id: 'a-old', farmer_id: 'f1', farm_id: 'farm1', season_id: null, activity_type: 'Weeding', activity_date: '2025-07-02',
  description: 'Weeded the rice rows.', quantity: null, unit: null, cost: 12, labor_count: 2, sync_status: 'synced',
  created_at: '2025-07-02T08:00:00Z', updated_at: '2025-07-02T08:00:00Z',
});

test('migration: an old activity loads with null weather and is not changed', () => {
  const loaded = W.normalizeActivity(OLD);
  assert.equal(loaded.weather_sky, null);
  assert.equal(loaded.rain_mm, null, 'null, not 0');
  assert.equal(loaded.day_feel, null);
  // everything the farmer saved is untouched
  for (const k of Object.keys(OLD)) assert.deepEqual(loaded[k], OLD[k], k);
  // reading does not write: the stored object itself has no new keys
  assert.ok(!('weather_sky' in OLD) && !('rain_mm' in OLD) && !('day_feel' in OLD));
  assert.equal(W.weatherLabel(OLD), null, 'nothing to show for an old record');
  assert.equal(W.hasWeather(OLD), false);
});

test('migration: a record with weather keeps it, and unknown values read as null', () => {
  const a = W.normalizeActivity({ ...OLD, weather_sky: 'rain', rain_mm: 12, day_feel: 'cool' });
  assert.deepEqual([a.weather_sky, a.rain_mm, a.day_feel], ['rain', 12, 'cool']);
  const bad = W.normalizeActivity({ ...OLD, weather_sky: 'tornado', rain_mm: 'abc', day_feel: 'freezing' });
  assert.deepEqual([bad.weather_sky, bad.rain_mm, bad.day_feel], [null, null, null]);
  assert.equal(W.normalizeActivity({ ...OLD, rain_mm: 0 }).rain_mm, 0, 'a measured 0 stays 0');
});

test('weather is optional: empty input is valid and produces nulls', () => {
  for (const input of [undefined, {}, { sky: null, rainMm: '', dayFeel: null }, { rainMm: '   ' }]) {
    const r = W.validateWeather(input);
    assert.equal(r.ok, true);
    assert.deepEqual(r.values, { weather_sky: null, rain_mm: null, day_feel: null });
  }
});

test('rain must be a number from 0 to 500, with a clear error code otherwise', () => {
  const ok = (v) => W.validateWeather({ rainMm: v });
  assert.equal(ok('0').values.rain_mm, 0);
  assert.equal(ok('12').values.rain_mm, 12);
  assert.equal(ok('12.34').values.rain_mm, 12.3);
  assert.equal(ok('12,5').values.rain_mm, 12.5, 'a comma is accepted as the decimal mark');
  assert.equal(ok('500').values.rain_mm, 500);
  assert.equal(ok('500').ok, true);
  for (const bad of ['501', '1000', '-1', '-0.5']) assert.deepEqual(ok(bad).errors, { rain_mm: bad.startsWith('-') ? 'rainNotNumber' : 'rainOutOfRange' }, bad);
  for (const bad of ['abc', '1e3', '12mm', '1.2.3', 'NaN']) assert.deepEqual(ok(bad).errors, { rain_mm: 'rainNotNumber' }, bad);
  assert.equal(ok('abc').ok, false);
  // a bad rain amount does not throw away the sky the farmer chose
  assert.equal(W.validateWeather({ sky: 'rain', rainMm: 'abc' }).values.weather_sky, 'rain');
});

test('only the allowed sky and day-feel values are kept', () => {
  assert.deepEqual([...W.SKY_OPTIONS], ['sunny', 'cloudy', 'rain', 'heavy_rain']);
  assert.deepEqual([...W.DAY_FEEL_OPTIONS], ['cool', 'warm', 'hot']);
  assert.equal(W.validateWeather({ sky: 'snow' }).values.weather_sky, null);
  assert.equal(W.validateWeather({ dayFeel: 'boiling' }).values.day_feel, null);
});

test('list text: "Rain · 12 mm", and nothing when nothing was recorded', () => {
  assert.equal(W.weatherLabel({ weather_sky: 'rain', rain_mm: 12 }), 'Rain · 12 mm');
  assert.equal(W.weatherLabel({ weather_sky: 'heavy_rain', rain_mm: 48.5, day_feel: 'cool' }), 'Heavy rain · 48.5 mm · Cool');
  assert.equal(W.weatherLabel({ weather_sky: 'sunny' }), 'Sunny');
  assert.equal(W.weatherLabel({ day_feel: 'hot' }), 'Hot');
  assert.equal(W.weatherLabel({ rain_mm: 0 }), '0 mm', 'a measured zero is shown');
  assert.equal(W.weatherLabel({}), null);
});

test('a day is rainy when the sky is rain or heavy rain, or measured rain is above 0', () => {
  assert.equal(W.isRainy({ weather_sky: 'rain' }), true);
  assert.equal(W.isRainy({ weather_sky: 'heavy_rain' }), true);
  assert.equal(W.isRainy({ weather_sky: 'sunny', rain_mm: 2 }), true, 'a measured amount wins over the sky');
  assert.equal(W.isRainy({ rain_mm: 0.1 }), true);
  assert.equal(W.isRainy({ weather_sky: 'sunny', rain_mm: 0 }), false);
  assert.equal(W.isRainy({ weather_sky: 'cloudy' }), false);
  assert.equal(W.isRainy({}), false);
});
