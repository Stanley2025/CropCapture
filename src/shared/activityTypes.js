'use strict';
/**
 * Crop activity types, grouped. The farmer picks the specific activity (for example
 * "Compost application"); the group (for example "Fertilizer application") is what filters
 * and reports use to bring related activities together.
 *
 * The stored value (farm_activities.activity_type) is the specific activity. Records saved
 * before the groups existed ("Weeding", "Irrigation", ...) keep working: see LEGACY_GROUP.
 */

/** Ordered sections. A section with a title is a group; one without is a plain list of activities. */
const CROP_ACTIVITY_SECTIONS = Object.freeze([
  { items: ['Land preparation'] },
  {
    title: 'Planting',
    items: ['Seed selection', 'Seed sorting', 'Seed treatment', 'Nursery preparation', 'Seed sowing', 'Broadcasting', 'Drilling', 'Transplanting', 'Direct planting', 'Gap filling'],
  },
  {
    title: 'Fertilizer application',
    items: ['Compost application', 'Manure application', 'NPK fertilizer application', 'Urea application', 'Soil amendment application'],
  },
  {
    title: 'Weeding',
    items: ['First weeding', 'Second weeding', 'Third weeding', 'Herbicide application', 'Mulching'],
  },
  {
    title: 'Irrigation and watering',
    items: ['Watering', 'Pump irrigation', 'Drip irrigation', 'Furrow irrigation', 'Nursery watering'],
  },
  {
    title: 'Pest management',
    items: ['Pest inspection', 'Manual pest removal', 'Setting traps', 'Insecticide application', 'Pesticide application', 'Pest-damaged plant removal'],
  },
  { items: ['Disease management', 'Pruning', 'Field inspection', 'Harvesting', 'Harvest preparation', 'Other crop activity'] },
]);

/**
 * The activities that actually put seed or plants in the ground. These (and the older plain
 * "Planting") set the planting date of a season; seed selection, sorting, treatment, nursery
 * preparation and gap filling do not.
 */
const PLANTING_ACTIVITIES = Object.freeze(['Planting', 'Seed sowing', 'Broadcasting', 'Drilling', 'Transplanting', 'Direct planting']);

/** Every activity a farmer can pick, in screen order. */
const CROP_ACTIVITY_TYPES = Object.freeze(CROP_ACTIVITY_SECTIONS.flatMap((s) => s.items));

/** Group titles, then plain activities: the choices of the activity-log filter. */
const CROP_ACTIVITY_FILTERS = Object.freeze(CROP_ACTIVITY_SECTIONS.flatMap((s) => (s.title ? [s.title] : s.items)));

/** Names used before the groups existed, mapped to their group. */
const LEGACY_GROUP = Object.freeze({
  planting: 'Planting',
  'fertilizer application': 'Fertilizer application',
  weeding: 'Weeding',
  irrigation: 'Irrigation and watering',
  'pest management': 'Pest management',
  'pesticide application': 'Pest management',
});

const GROUP_OF = (() => {
  const map = {};
  for (const s of CROP_ACTIVITY_SECTIONS) if (s.title) for (const item of s.items) map[item.toLowerCase()] = s.title;
  return Object.freeze({ ...LEGACY_GROUP, ...map });
})();

const norm = (s) => String(s || '').trim().toLowerCase();

/** The group an activity belongs to, or null. */
function groupOf(activityType) {
  return GROUP_OF[norm(activityType)] || null;
}

/** Short labels some screens use, mapped to the group they mean. */
const CATEGORY_ALIAS = Object.freeze({
  fertilizer: 'Fertilizer application',
  'pest control': 'Pest management',
  irrigation: 'Irrigation and watering',
  watering: 'Irrigation and watering',
});

/**
 * Does an activity belong under a filter? True when the names match, when the activity is in
 * the group the filter names, or (for the short labels the tabs use) when the name contains it.
 */
function matchesCategory(activityType, category) {
  const type = norm(activityType);
  const cat = norm(category);
  if (!cat || cat === 'all') return true;
  if (type === cat || type.includes(cat)) return true;
  const group = groupOf(activityType);
  if (!group) return false;
  const wanted = CATEGORY_ALIAS[cat] || category;
  return norm(group) === norm(wanted);
}

module.exports = { PLANTING_ACTIVITIES, CROP_ACTIVITY_SECTIONS, CROP_ACTIVITY_TYPES, CROP_ACTIVITY_FILTERS, LEGACY_GROUP, groupOf, matchesCategory };
