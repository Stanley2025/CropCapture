const test = require('node:test');
const assert = require('node:assert/strict');
const Y = require('../src/shared/farmYear');

const act = (date, type = 'Weeding', extra = {}) => ({ id: `${type}-${date}-${Math.random()}`, farm_id: 'f1', activity_type: type, activity_date: date, ...extra });
const harvest = (date, quantity, unit = 'kg', extra = {}) => ({ id: `h-${date}`, farm_id: 'f1', harvest_date: date, quantity, unit, ...extra });

// ---------------------------------------------------------------------------
// Year grouping: the year comes from the record's own date
// ---------------------------------------------------------------------------
test('the year is read from the date itself', () => {
  assert.equal(Y.yearOf('2026-06-15'), 2026);
  assert.equal(Y.yearOf('2026-06-15T10:30:00Z'), 2026);
  assert.equal(Y.yearOf(' 2025-01-01 '), 2025);
  for (const bad of ['', null, undefined, '15 Jun 2026', '2026-13-01', '2026-00-10', '2026-06-00', 'abc']) assert.equal(Y.yearOf(bad), null, String(bad));
});

test('31 December belongs to that year and 1 January to the next', () => {
  const acts = [act('2025-12-31', 'Weeding'), act('2026-01-01', 'Planting'), act('2026-12-31', 'Weeding'), act('2027-01-01', 'Weeding')];
  const years = (y) => Y.activitiesInYear(acts, y).map((a) => a.activity_date);
  assert.deepEqual(years(2025), ['2025-12-31']);
  assert.deepEqual(years(2026), ['2026-01-01', '2026-12-31']);
  assert.deepEqual(years(2027), ['2027-01-01']);
  // harvests too
  const hs = [harvest('2025-12-31', 10), harvest('2026-01-01', 20)];
  assert.equal(Y.totalHarvestKg(Y.harvestsInYear(hs, 2025)), 10);
  assert.equal(Y.totalHarvestKg(Y.harvestsInYear(hs, 2026)), 20);
  // a season that runs over New Year appears under each year by the date of each entry: nothing is lost or counted twice
  const counted = [2025, 2026, 2027].map((y) => Y.summarizeYear({ activities: acts, year: y }).activityCount).reduce((a, b) => a + b, 0);
  assert.equal(counted, acts.length);
});

test('year tabs: every year with data plus the current year, newest first', () => {
  const now = new Date('2026-11-21T10:00:00Z');
  const years = Y.yearsWithData({ activities: [act('2024-05-01'), act('2025-12-31'), act('2024-06-01'), act('bad date')], harvests: [harvest('2023-09-09', 5)], now });
  assert.deepEqual(years, [2026, 2025, 2024, 2023]);
  assert.deepEqual(Y.yearsWithData({ now }), [2026], 'a farm with no records still has the current year');
  assert.deepEqual(Y.yearsWithData({ activities: [act('2026-02-02')], now }), [2026], 'no duplicate for the current year');
});

test('deleted records are left out', () => {
  const acts = [act('2026-03-01'), act('2026-03-02', 'Weeding', { deleted_at: '2026-04-01' })];
  assert.equal(Y.summarizeYear({ activities: acts, year: 2026 }).activityCount, 1);
});

// ---------------------------------------------------------------------------
// Rainy days
// ---------------------------------------------------------------------------
test('rainy days: rain or heavy rain, or measured rain above 0; a day is counted once', () => {
  const acts = [
    act('2026-05-01', 'Weeding', { weather_sky: 'rain' }),
    act('2026-05-01', 'Planting', { weather_sky: 'rain' }), // same day, second activity: still one rainy day
    act('2026-05-02', 'Weeding', { weather_sky: 'heavy_rain' }),
    act('2026-05-03', 'Weeding', { weather_sky: 'sunny', rain_mm: 4 }), // measured rain wins over the sky
    act('2026-05-04', 'Weeding', { weather_sky: 'sunny' }),
    act('2026-05-05', 'Weeding', { weather_sky: 'cloudy', rain_mm: 0 }),
    act('2026-05-06', 'Weeding'), // no weather recorded
    act('2026-06-10', 'Weeding', { weather_sky: 'rain' }),
  ];
  const months = Y.rainyDaysByMonth(acts, 2026);
  const may = months[4];
  assert.equal(may.rainyDays, 3);
  assert.equal(may.recordedDays, 5, 'five days have weather; the sixth has none');
  assert.equal(months[5].rainyDays, 1);
  assert.equal(months.length, 12);
});

test('"Not recorded" is never 0: a month with no weather is null, a month with weather and no rain is 0', () => {
  const acts = [act('2026-07-01', 'Weeding', { weather_sky: 'sunny' }), act('2026-08-01', 'Weeding')];
  const months = Y.rainyDaysByMonth(acts, 2026);
  assert.equal(months[6].rainyDays, 0, 'July: weather recorded, no rain');
  assert.equal(months[7].rainyDays, null, 'August: activity but no weather recorded');
  assert.equal(months[0].rainyDays, null, 'January: nothing at all');
  // the totals follow the same rule
  assert.equal(Y.summarizeYear({ activities: acts, year: 2026 }).rainyDaysTotal, 0);
  assert.equal(Y.summarizeYear({ activities: [act('2026-08-01')], year: 2026 }).rainyDaysTotal, null);
});

test('every measure is null when it was not recorded, and only then', () => {
  const empty = Y.summarizeYear({ year: 2026 });
  assert.deepEqual(
    [empty.hasData, empty.harvestKg, empty.activityCount, empty.firstPlantingDate, empty.lastHarvestDate, empty.rainyDaysTotal, empty.weedingCount, empty.fertilizerCount],
    [false, null, null, null, null, null, null, null]
  );

  const rec = Y.summarizeYear({
    activities: [act('2026-04-02', 'Seed sowing'), act('2026-05-01', 'First weeding'), act('2026-05-20', 'Second weeding'), act('2026-06-01', 'Urea application')],
    harvests: [harvest('2026-09-01', 0)],
    year: 2026,
  });
  assert.equal(rec.harvestKg, 0, 'a recorded harvest of 0 kg stays 0');
  assert.equal(rec.activityCount, 4);
  assert.equal(rec.firstPlantingDate, '2026-04-02');
  assert.equal(rec.lastHarvestDate, '2026-09-01');
  assert.equal(rec.weedingCount, 2);
  assert.equal(rec.fertilizerCount, 1);
  const noFert = Y.summarizeYear({ activities: [act('2026-05-01', 'First weeding')], year: 2026 });
  assert.equal(noFert.fertilizerCount, null, 'no fertilizer recorded is "Not recorded", not 0');

  assert.equal(Y.showMeasure(null, 'Not recorded'), 'Not recorded');
  assert.equal(Y.showMeasure(undefined, 'Not recorded', 'kg'), 'Not recorded');
  assert.equal(Y.showMeasure(NaN, 'Not recorded'), 'Not recorded');
  assert.equal(Y.showMeasure(0, 'Not recorded'), '0');
  assert.equal(Y.showMeasure(0, 'Not recorded', 'kg'), '0 kg');
  assert.equal(Y.showMeasure(250, 'Not recorded', 'kg'), '250 kg');
});

test('harvest total: kg as stored, or converted from the unit; null when nothing has a weight', () => {
  assert.equal(Y.totalHarvestKg([harvest('2026-09-01', 3, 'bag')]), 150, '3 bags of 50 kg');
  assert.equal(Y.totalHarvestKg([harvest('2026-09-01', 2, 'bag', { quantity_kg: 90 })]), 90, 'the stored kg wins');
  assert.equal(Y.totalHarvestKg([harvest('2026-09-01', 120, 'kg'), harvest('2026-09-10', 80.5, 'kg')]), 200.5);
  assert.equal(Y.totalHarvestKg([harvest('2026-09-01', 6, 'bunches')]), null, 'bunches have no weight');
  assert.equal(Y.totalHarvestKg([]), null);
});

test('planting: only activities that put seed or plants in the ground count', () => {
  const acts = [act('2026-03-01', 'Seed selection'), act('2026-03-05', 'Nursery preparation'), act('2026-04-20', 'Transplanting'), act('2026-04-10', 'Seed sowing')];
  assert.equal(Y.firstPlantingDate(acts), '2026-04-10');
  assert.equal(Y.firstPlantingDate([act('2026-03-01', 'Seed selection')]), null);
});

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
test('the PDF page holds the farm name, the year, the creation date and only recorded data', () => {
  const activities = [act('2026-05-01', 'Weeding', { weather_sky: 'rain', rain_mm: 12 }), act('2026-05-09', 'Planting <b>')];
  const summary = Y.summarizeYear({ activities, harvests: [harvest('2026-09-01', 100)], year: 2026 });
  const labels = {
    title: 'Farm record', yearLine: 'Year 2026', createdOn: 'Created on 2026-11-21', tileHarvest: 'Total harvest', tileActivities: 'Activities',
    tileFirstPlanting: 'First planting', tileLastHarvest: 'Last harvest', rainyDays: 'Rainy days recorded each month', rainyDaysShort: 'Rainy days',
    month: 'Month', timeline: 'Activity timeline', date: 'Date', activity: 'Activity', weather: 'Weather', noWeather: 'No weather recorded',
    noRecords: 'No records for this year yet.', footer: 'This record contains only what the farmer recorded.',
    monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  };
  const html = Y.buildYearPdfHtml({
    farmName: 'Kollie <Rice> Farm', year: 2026, createdOn: '2026-11-21', summary, activities, labels, notRecorded: 'Not recorded',
    weatherText: (a) => (a.weather_sky ? 'Rain · 12 mm' : null),
  });
  for (const must of ['Kollie &lt;Rice&gt; Farm', 'Year 2026', 'Created on 2026-11-21', '100 kg', 'Rain · 12 mm', 'No weather recorded', 'Not recorded', 'Planting &lt;b&gt;']) {
    assert.ok(html.includes(must), must);
  }
  assert.ok(!html.includes('<b>'), 'text from the farmer is escaped');
  for (const banned of ['verified', 'tamper', 'cryptographic']) assert.ok(!html.toLowerCase().includes(banned), banned);
});
