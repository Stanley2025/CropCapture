const test = require('node:test');
const assert = require('node:assert/strict');

const A = require('../src/shared/activityTypes');
const { plantingDateOf } = require('../src/shared/seasonWeather');

const GROUPS = {
  Planting: ['Seed selection', 'Seed sorting', 'Seed treatment', 'Nursery preparation', 'Seed sowing', 'Broadcasting', 'Drilling', 'Transplanting', 'Direct planting', 'Gap filling'],
  'Fertilizer application': ['Compost application', 'Manure application', 'NPK fertilizer application', 'Urea application', 'Soil amendment application'],
  Weeding: ['First weeding', 'Second weeding', 'Third weeding', 'Herbicide application', 'Mulching'],
  'Irrigation and watering': ['Watering', 'Pump irrigation', 'Drip irrigation', 'Furrow irrigation', 'Nursery watering'],
  'Pest management': ['Pest inspection', 'Manual pest removal', 'Setting traps', 'Insecticide application', 'Pesticide application', 'Pest-damaged plant removal'],
};

test('the four groups hold exactly the activities that were asked for, in order', () => {
  for (const [title, items] of Object.entries(GROUPS)) {
    const section = A.CROP_ACTIVITY_SECTIONS.find((s) => s.title === title);
    assert.ok(section, `${title} group exists`);
    assert.deepEqual([...section.items], items, title);
  }
  assert.deepEqual(A.CROP_ACTIVITY_SECTIONS.filter((s) => s.title).map((s) => s.title), Object.keys(GROUPS), 'group order');
});

test('every activity is offered once, and the existing activities are still there', () => {
  const all = [...A.CROP_ACTIVITY_TYPES];
  assert.equal(new Set(all).size, all.length, 'no duplicates');
  for (const keep of ['Land preparation', 'Disease management', 'Pruning', 'Field inspection', 'Harvest preparation', 'Other crop activity']) {
    assert.ok(all.includes(keep), `${keep} is still offered`);
  }
  assert.equal(all.filter((t) => t === 'Pesticide application').length, 1, 'Pesticide application lives under Pest management only');
  assert.ok(!all.includes('Planting'), 'the plain "Planting" is now the group, with specific activities under it');
  assert.equal(plantingDateOf({ id: 's', planting_date: '2026-06-01' }, [{ season_id: 's', activity_type: 'Planting', activity_date: '2026-05-20' }]), '2026-05-20', 'an old plain Planting record still sets the date');
});

test('an activity knows its group, including names saved before groups existed', () => {
  for (const [title, items] of Object.entries(GROUPS)) for (const item of items) assert.equal(A.groupOf(item), title, item);
  assert.equal(A.groupOf('Weeding'), 'Weeding');
  assert.equal(A.groupOf('Irrigation'), 'Irrigation and watering', 'old name');
  assert.equal(A.groupOf('Pest management'), 'Pest management');
  assert.equal(A.groupOf('fertilizer application'), 'Fertilizer application', 'case does not matter');
  assert.equal(A.groupOf('Planting'), 'Planting', 'an old plain Planting record belongs to the group');
  assert.equal(A.groupOf('Land preparation'), null);
  assert.equal(A.groupOf(undefined), null);
});

test('filtering by a group finds every activity in it, and nothing from another group', () => {
  for (const [title, items] of Object.entries(GROUPS)) {
    for (const item of items) assert.ok(A.matchesCategory(item, title), `${item} under ${title}`);
    for (const [other, otherItems] of Object.entries(GROUPS)) {
      if (other === title) continue;
      for (const item of otherItems) assert.ok(!A.matchesCategory(item, title), `${item} is not under ${title}`);
    }
  }
  assert.ok(A.matchesCategory('Irrigation', 'Irrigation and watering'), 'an old record is still found');
  assert.ok(A.matchesCategory('Weeding', 'Weeding'));
  assert.ok(A.matchesCategory('Planting', 'Planting'));
  assert.ok(A.matchesCategory('Seed sowing', 'Planting'), 'a planting activity is found by the Planting filter');
  assert.ok(!A.matchesCategory('Compost application', 'Planting'));
  assert.ok(A.matchesCategory('Anything at all', 'All'));
});

test('the short labels on the activities tab find the new activities too', () => {
  assert.ok(A.matchesCategory('Compost application', 'Fertilizer'));
  assert.ok(A.matchesCategory('NPK fertilizer application', 'Fertilizer'));
  assert.ok(A.matchesCategory('Setting traps', 'Pest control'));
  assert.ok(A.matchesCategory('Pesticide application', 'Pest control'));
  assert.ok(A.matchesCategory('Herbicide application', 'Weeding'));
  assert.ok(A.matchesCategory('Land preparation', 'Land prep'));
  assert.ok(!A.matchesCategory('Setting traps', 'Fertilizer'));
});

test('the log filter lists the groups, not every sub-activity', () => {
  const f = [...A.CROP_ACTIVITY_FILTERS];
  for (const g of Object.keys(GROUPS)) assert.ok(f.includes(g));
  assert.ok(!f.includes('Compost application'));
  assert.ok(f.includes('Planting') && f.includes('Land preparation'));
  assert.ok(!f.includes('Seed sowing'));
});

test('only activities that put seed or plants in the ground set the planting date', () => {
  const season = { id: 's', planting_date: '2026-06-30' };
  const act = (type, date) => ({ season_id: 's', activity_type: type, activity_date: date });
  // preparing seed earlier does not count as planting
  const prep = [act('Seed selection', '2026-04-01'), act('Seed sorting', '2026-04-02'), act('Seed treatment', '2026-04-03'), act('Nursery preparation', '2026-04-04'), act('Gap filling', '2026-04-05')];
  assert.equal(plantingDateOf(season, prep), '2026-06-30', 'falls back to the season date');
  for (const type of ['Seed sowing', 'Broadcasting', 'Drilling', 'Transplanting', 'Direct planting', 'Planting']) {
    assert.equal(plantingDateOf(season, [...prep, act(type, '2026-05-10')]), '2026-05-10', type);
  }
  // nursery sowing first, transplanting later: the earliest planting act wins
  assert.equal(plantingDateOf(season, [act('Transplanting', '2026-06-10'), act('Seed sowing', '2026-05-12')]), '2026-05-12');
  assert.deepEqual([...A.PLANTING_ACTIVITIES].sort(), ['Broadcasting', 'Direct planting', 'Drilling', 'Planting', 'Seed sowing', 'Transplanting']);
});
