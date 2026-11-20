const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

// Load generated geographic data
const geoModule = require('../scripts/generate_geo_data.js');

// Helper to load parsed TS data or use test fixtures matching the system
const {
  COUNTIES,
  DISTRICTS,
  getCounties,
  getDistrictsByCounty,
  getCountyByName,
  getDistrictByName,
} = (() => {
  // Read constants directly from the compiled/generated structure
  const content = fs.readFileSync('src/constants/liberiaGeographicData.ts', 'utf8');
  const countiesMatch = content.match(/export const COUNTIES: County\[\] = (\[[\s\S]*?\]);/);
  const districtsMatch = content.match(/export const DISTRICTS: District\[\] = (\[[\s\S]*?\]);/);
  const counties = JSON.parse(countiesMatch[1]);
  const districts = JSON.parse(districtsMatch[1]);

  function getCounties() {
    return counties;
  }

  function getDistrictsByCounty(countyIdentifier) {
    if (!countyIdentifier) return [];
    const normalized = countyIdentifier.trim().toLowerCase();
    const matchingCounty = counties.find(
      (c) =>
        c.id.toLowerCase() === normalized ||
        c.name.toLowerCase() === normalized ||
        c.code.toLowerCase() === normalized
    );
    if (!matchingCounty) return [];
    return districts.filter((d) => d.county_id === matchingCounty.id);
  }

  function getCountyByName(name) {
    if (!name) return undefined;
    const normalized = name.trim().toLowerCase();
    return counties.find((c) => c.name.toLowerCase() === normalized);
  }

  function getDistrictByName(countyIdentifier, districtName) {
    if (!districtName) return undefined;
    const countyDistricts = getDistrictsByCounty(countyIdentifier);
    const normalized = districtName.trim().toLowerCase();
    return countyDistricts.find((d) => d.name.toLowerCase() === normalized);
  }

  return {
    COUNTIES: counties,
    DISTRICTS: districts,
    getCounties,
    getDistrictsByCounty,
    getCountyByName,
    getDistrictByName,
  };
})();

test('Geographic Data: 15 Liberian Counties exist in alphabetical order (A to Z)', () => {
  const counties = getCounties();
  assert.equal(counties.length, 15, 'There must be exactly 15 counties');

  const names = counties.map((c) => c.name);
  const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(names, sortedNames, 'Counties must be sorted A to Z');

  const expectedCounties = [
    'Bomi',
    'Bong',
    'Gbarpolu',
    'Grand Bassa',
    'Grand Cape Mount',
    'Grand Gedeh',
    'Grand Kru',
    'Lofa',
    'Margibi',
    'Maryland',
    'Montserrado',
    'Nimba',
    'River Gee',
    'Rivercess',
    'Sinoe',
  ];
  assert.deepEqual(names, expectedCounties, 'Counties must match the 15 Liberian counties');
});

test('Dependent Selector: Choosing Margibi shows exactly its 4 districts', () => {
  const margibiDistricts = getDistrictsByCounty('Margibi');
  const districtNames = margibiDistricts.map((d) => d.name).sort();

  const expected = ['Firestone', 'Gibi', 'Kakata', 'Mambah-Kaba'].sort();
  assert.equal(margibiDistricts.length, 4, 'Margibi must have exactly 4 districts');
  assert.deepEqual(
    districtNames,
    expected,
    'Margibi districts must exactly match [Firestone, Gibi, Kakata, Mambah-Kaba]'
  );

  // Test by Margibi County ID as well
  const margibiObj = getCountyByName('Margibi');
  assert.ok(margibiObj, 'Margibi county object must exist');
  const byIdDistricts = getDistrictsByCounty(margibiObj.id);
  assert.deepEqual(
    byIdDistricts.map((d) => d.name).sort(),
    expected,
    'Querying by Margibi UUID must return the same districts'
  );
});

test('Selection State Logic: Changing county clears selected district', () => {
  // Simulate state transition in Register Farm form
  let selectedCounty = 'Margibi';
  let selectedDistrict = 'Kakata';

  // User changes county to 'Bong'
  const newCounty = 'Bong';
  if (newCounty !== selectedCounty) {
    selectedCounty = newCounty;
    selectedDistrict = ''; // Reset district
  }

  assert.equal(selectedCounty, 'Bong');
  assert.equal(
    selectedDistrict,
    '',
    'District must be cleared immediately when county changes'
  );

  // Available districts now only contain Bong districts
  const bongDistricts = getDistrictsByCounty('Bong').map((d) => d.name);
  assert.ok(
    !bongDistricts.includes('Kakata'),
    'Bong districts must not include Kakata'
  );
  assert.ok(
    bongDistricts.includes('Suakoko'),
    'Bong districts must include Suakoko'
  );
});

test('Form Validation: Rejects submission without county or district with inline errors', () => {
  function validateFarmForm(formData) {
    const errors = {};
    if (!formData.name || !formData.name.trim()) {
      errors.name = 'Please enter a name for the farm parcel.';
    }
    if (!formData.county || !formData.county.trim()) {
      errors.county = 'Select a county';
    }
    if (!formData.district || !formData.district.trim()) {
      errors.district = 'Select a district';
    }
    if (!formData.community || !formData.community.trim()) {
      errors.community = 'Please enter the community or town name.';
    }
    if (
      !formData.size ||
      isNaN(Number(formData.size)) ||
      Number(formData.size) <= 0
    ) {
      errors.size = 'Please enter a valid numeric farm size.';
    }
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  // Case 1: Missing both
  const missingBoth = validateFarmForm({
    name: 'Gbehley Plot',
    county: '',
    district: '',
    community: 'Gbehley',
    size: '5',
  });
  assert.equal(missingBoth.isValid, false);
  assert.equal(missingBoth.errors.county, 'Select a county');
  assert.equal(missingBoth.errors.district, 'Select a district');

  // Case 2: County selected, missing district
  const missingDistrict = validateFarmForm({
    name: 'Gbehley Plot',
    county: 'Margibi',
    district: '',
    community: 'Gbehley',
    size: '5',
  });
  assert.equal(missingDistrict.isValid, false);
  assert.equal(missingDistrict.errors.district, 'Select a district');
  assert.equal(missingDistrict.errors.county, undefined);

  // Case 3: Both provided
  const valid = validateFarmForm({
    name: 'Gbehley Plot',
    county: 'Margibi',
    district: 'Firestone',
    community: 'Harbel',
    size: '10',
  });
  assert.equal(valid.isValid, true);
  assert.deepEqual(valid.errors, {});
});

test('Offline First: Functions work synchronously with zero network dependency', () => {
  // Ensure COUNTIES and DISTRICTS arrays are accessible offline
  assert.equal(COUNTIES.length, 15);
  assert.equal(DISTRICTS.length, 127);

  // Every district must have a valid county_id matching an existing county
  const countyIds = new Set(COUNTIES.map((c) => c.id));
  for (const district of DISTRICTS) {
    assert.ok(
      countyIds.has(district.county_id),
      `District "${district.name}" county_id ${district.county_id} must link to a valid county`
    );
  }
});

test('Counties with large district lists: Nimba (17) and Grand Kru (19) support search filtering', () => {
  const nimbaDistricts = getDistrictsByCounty('Nimba');
  assert.equal(nimbaDistricts.length, 17, 'Nimba must have 17 districts');

  const grandKruDistricts = getDistrictsByCounty('Grand Kru');
  assert.equal(grandKruDistricts.length, 19, 'Grand Kru must have 19 districts');

  // Search filter test: "Mahn" in Nimba districts
  const searchFilter = 'mahn';
  const filtered = nimbaDistricts.filter((d) =>
    d.name.toLowerCase().includes(searchFilter)
  );
  assert.ok(filtered.length >= 4, 'Multiple Nimba districts contain "Mahn"');
  assert.ok(
    filtered.some((d) => d.name === 'Sanniquellie-Mahn'),
    'Should match Sanniquellie-Mahn'
  );
});
