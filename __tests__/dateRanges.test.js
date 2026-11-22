const test = require('node:test');
const assert = require('node:assert/strict');
const { yearsForPicker, DOB_FIRST_YEAR } = require('../src/shared/dateRanges');

test('date of birth offers every year from 1920 to the current year, newest first', () => {
  const years = yearsForPicker(true, new Date('2026-11-21T10:00:00Z'));
  assert.equal(years[0], 2026);
  assert.equal(years.at(-1), 1920);
  assert.equal(years.length, 2026 - 1920 + 1);
  assert.equal(new Set(years).size, years.length, 'no duplicates');
  for (const y of [1930, 1955, 1984, 1990, 2000, 2012, 2020]) assert.ok(years.includes(y), `${y} can be chosen`);
  assert.equal(DOB_FIRST_YEAR, 1920);
});

test('other dates (farm registration, activities) keep a window around today', () => {
  const years = yearsForPicker(false, new Date('2026-11-21T10:00:00Z'));
  assert.equal(years[0], 2031);
  assert.equal(years.at(-1), 2006);
});
