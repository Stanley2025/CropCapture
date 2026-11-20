const test = require('node:test');
const assert = require('node:assert/strict');

const VALID_ANIMAL_TYPES = ['Goats', 'Pigs', 'Sheep', 'Chickens', 'Cow'];
const VALID_PRODUCTION_PURPOSES = [
  'Meat production',
  'Egg production',
  'Milk production',
  'Breeding',
];
const VALID_MANAGEMENT_SYSTEMS = ['Free-range', 'Semi-intensive', 'Intensive'];
const VALID_WATER_SOURCES = [
  'Well',
  'Hand pump',
  'River or stream',
  'Borehole',
  'Rainwater',
  'Pipe-borne water',
];

function buildFarmPayload({
  name,
  farmer_id,
  county,
  district,
  community,
  size,
  farming_type,
  livestock_data,
}) {
  const errors = [];

  if (!name || !name.trim()) errors.push('Farm name required');
  if (!county) errors.push('County required');
  if (!district) errors.push('District required');
  if (!community) errors.push('Community required');

  let livestock_details = null;

  if (farming_type === 'livestock' || farming_type === 'both') {
    if (!livestock_data) {
      errors.push('Livestock data required');
    } else {
      if (!VALID_ANIMAL_TYPES.includes(livestock_data.animal_type)) {
        errors.push(`Invalid animal type: ${livestock_data.animal_type}`);
      }
      if (
        !livestock_data.head_count ||
        isNaN(Number(livestock_data.head_count)) ||
        Number(livestock_data.head_count) <= 0
      ) {
        errors.push('Valid animal count required');
      }
      if (
        !livestock_data.production_purpose ||
        !Array.isArray(livestock_data.production_purpose) ||
        livestock_data.production_purpose.length === 0
      ) {
        errors.push('At least one production purpose required');
      }
      if (
        livestock_data.water_source &&
        !VALID_WATER_SOURCES.includes(livestock_data.water_source)
      ) {
        errors.push(`Invalid water source: ${livestock_data.water_source}`);
      }
      if (
        livestock_data.management_system &&
        !VALID_MANAGEMENT_SYSTEMS.includes(livestock_data.management_system)
      ) {
        errors.push(`Invalid management system: ${livestock_data.management_system}`);
      }

      livestock_details = {
        animal_type: livestock_data.animal_type,
        breed: livestock_data.breed,
        head_count: Number(livestock_data.head_count),
        production_purpose: livestock_data.production_purpose,
        management_system: livestock_data.management_system,
        housing_type: livestock_data.housing_type,
        housing_size: livestock_data.housing_size,
        housing_capacity: livestock_data.housing_capacity,
        grazing_availability: livestock_data.grazing_availability,
        grazing_arrangement: livestock_data.grazing_arrangement,
        grazing_area: livestock_data.grazing_area,
        water_source: livestock_data.water_source,
        feeding_system: livestock_data.feeding_system,
      };
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    payload: {
      name,
      farmer_id,
      county,
      district,
      community,
      size,
      farming_type,
      livestock_details,
    },
  };
}

test('Livestock Interface: Animal types match the 5 required species', () => {
  const species = ['Goats', 'Pigs', 'Sheep', 'Chickens', 'Cow'];
  for (const s of species) {
    assert.ok(VALID_ANIMAL_TYPES.includes(s), `Must support species ${s}`);
  }
  assert.equal(VALID_ANIMAL_TYPES.length, 5);
});

test('Livestock Interface: Production purpose options match required list', () => {
  const purposes = [
    'Meat production',
    'Egg production',
    'Milk production',
    'Breeding',
  ];
  assert.deepEqual(VALID_PRODUCTION_PURPOSES, purposes);
});

test('Livestock Interface: Management systems match free-range, semi-intensive, intensive', () => {
  assert.deepEqual(VALID_MANAGEMENT_SYSTEMS, [
    'Free-range',
    'Semi-intensive',
    'Intensive',
  ]);
});

test('Livestock Interface: Water sources match specified water sources', () => {
  const water = [
    'Well',
    'Hand pump',
    'River or stream',
    'Borehole',
    'Rainwater',
    'Pipe-borne water',
  ];
  assert.deepEqual(VALID_WATER_SOURCES, water);
});

test('Livestock Registration: Successfully constructs livestock payload for Goats and Pigs', () => {
  const res = buildFarmPayload({
    name: 'Sanniquellie Goat Farm',
    farmer_id: 'f1111111-1111-1111-1111-111111111101',
    county: 'Nimba',
    district: 'Sanniquellie-Mahn',
    community: 'Gbehley',
    size: 4.5,
    farming_type: 'livestock',
    livestock_data: {
      animal_type: 'Goats',
      breed: 'West African Dwarf',
      head_count: 30,
      production_purpose: ['Meat production', 'Breeding'],
      management_system: 'Semi-intensive',
      housing_type: 'Raised Slatted Wooden Pen',
      housing_size: '20 x 40 ft',
      housing_capacity: 50,
      grazing_availability: true,
      grazing_arrangement: 'Communal Village Pasture',
      grazing_area: '3 Acres',
      water_source: 'Well',
      feeding_system: 'Mixed Feeding (Pasture + Concentrates)',
    },
  });

  assert.equal(res.isValid, true);
  assert.equal(res.payload.livestock_details.animal_type, 'Goats');
  assert.equal(res.payload.livestock_details.head_count, 30);
  assert.deepEqual(res.payload.livestock_details.production_purpose, [
    'Meat production',
    'Breeding',
  ]);
  assert.equal(res.payload.livestock_details.water_source, 'Well');
});

test('Livestock Registration: Crops only does not require livestock details', () => {
  const res = buildFarmPayload({
    name: 'Gbehley Rice Plot',
    farmer_id: 'f1111111-1111-1111-1111-111111111101',
    county: 'Nimba',
    district: 'Sanniquellie-Mahn',
    community: 'Gbehley',
    size: 10,
    farming_type: 'crops',
    livestock_data: null,
  });

  assert.equal(res.isValid, true);
  assert.equal(res.payload.livestock_details, null);
});

test('Livestock Registration: Fails validation if animal count is <= 0 or missing purpose', () => {
  const res = buildFarmPayload({
    name: 'Invalid Livestock Parcel',
    farmer_id: 'f1111111-1111-1111-1111-111111111101',
    county: 'Nimba',
    district: 'Sanniquellie-Mahn',
    community: 'Gbehley',
    size: 5,
    farming_type: 'livestock',
    livestock_data: {
      animal_type: 'Cow',
      head_count: 0, // Invalid!
      production_purpose: [], // Invalid!
    },
  });

  assert.equal(res.isValid, false);
  assert.ok(res.errors.includes('Valid animal count required'));
  assert.ok(res.errors.includes('At least one production purpose required'));
});
