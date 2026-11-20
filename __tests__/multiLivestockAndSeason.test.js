const test = require('node:test');
const assert = require('node:assert/strict');

const VALID_LIVESTOCK_SPECIES = ['Goats', 'Pigs', 'Sheep', 'Chickens', 'Cow'];
const VALID_PURPOSES = ['Meat production', 'Egg production', 'Milk production', 'Breeding'];
const VALID_SYSTEMS = ['Free-range', 'Semi-intensive', 'Intensive'];
const CROPS_CATALOGUE = [
  { name: 'Coffee', code: 'COFF', varieties: ['Liberica Indigenous', 'Robusta', 'Arabica'] },
  { name: 'Cocoa', code: 'COCO', varieties: ['Forastero Hybrid', 'Trinitario Elite'] },
  { name: 'Rice', code: 'RICE', varieties: ['Suakoko 8', 'LAC 23', 'Nerica L-19'] },
  { name: 'Cassava', code: 'CASS', varieties: ['CARICASS 1', 'TMS 30572', 'Bassa Girl'] },
  { name: 'Oil Palm', code: 'PALM', varieties: ['Tenera Hybrid', 'Dura'] },
  { name: 'Maize', code: 'MAIZ', varieties: ['DMR-ESR-Y', 'Western Yellow'] },
];

function buildFarmPayload({
  name,
  farmer_id,
  county,
  district,
  community,
  size,
  farming_type,
  selected_animals,
  selected_crops,
  breed,
  head_count,
  production_purposes,
  management_system,
}) {
  const errors = [];
  if (!name || !name.trim()) errors.push('Farm name required');
  if (!county) errors.push('County required');
  if (!district) errors.push('District required');
  if (!community) errors.push('Community required');

  let livestock_details = null;

  if (farming_type === 'livestock' || farming_type === 'both') {
    if (!selected_animals || selected_animals.length === 0) {
      errors.push('At least one livestock animal species required');
    } else {
      const invalid = selected_animals.filter((a) => !VALID_LIVESTOCK_SPECIES.includes(a));
      if (invalid.length > 0) {
        errors.push(`Invalid species: ${invalid.join(', ')}`);
      }
    }

    if (!head_count || isNaN(Number(head_count)) || Number(head_count) <= 0) {
      errors.push('Valid total head count required');
    }

    if (!production_purposes || production_purposes.length === 0) {
      errors.push('At least one production purpose required');
    }

    livestock_details = {
      animal_type: (selected_animals || []).join(', '),
      selected_animals: selected_animals || [],
      breed,
      head_count: Number(head_count),
      production_purpose: production_purposes,
      management_system: management_system || 'Semi-intensive',
    };
  }

  return {
    isValid: errors.length === 0,
    errors,
    farm: {
      name,
      farmer_id,
      county,
      district,
      community,
      size: Number(size),
      farming_type,
      selected_crops: farming_type === 'both' || farming_type === 'crops' ? selected_crops : undefined,
      livestock_details,
    },
  };
}

function buildSeasonPayload({
  farm,
  cycle_type,
  selected_crop,
  crop_variety,
  livestock_species,
  livestock_breed,
  livestock_head_count,
  livestock_purposes,
  livestock_management,
  season_name,
  planting_date,
  harvest_date,
  cultivated_area,
}) {
  const errors = [];

  if (!farm || !farm.id) {
    errors.push('Farm parcel required');
  }

  const isLivestockCycle = cycle_type === 'livestock';

  if (isLivestockCycle) {
    if (!livestock_species || !VALID_LIVESTOCK_SPECIES.includes(livestock_species)) {
      errors.push('Valid livestock species required');
    }
    if (!livestock_head_count || isNaN(Number(livestock_head_count)) || Number(livestock_head_count) <= 0) {
      errors.push('Valid batch head count required');
    }
    if (!livestock_purposes || livestock_purposes.length === 0) {
      errors.push('At least one production purpose required');
    }
  } else {
    if (!selected_crop) {
      errors.push('Selected crop required');
    }
    if (!cultivated_area || isNaN(Number(cultivated_area)) || Number(cultivated_area) <= 0) {
      errors.push('Valid cultivated area required');
    }
  }

  const season = {
    farm_id: farm?.id,
    cycle_type: isLivestockCycle ? 'livestock' : 'crops',
    crop_id: isLivestockCycle ? `livestock-${livestock_species.toLowerCase()}` : selected_crop?.id,
    crop_variety_id: isLivestockCycle ? livestock_breed : crop_variety,
    season_name,
    planting_date,
    expected_harvest_date: harvest_date,
    cultivated_area: Number(cultivated_area) || farm?.size || 1,
    status: 'active',
    livestock_type: isLivestockCycle ? livestock_species : undefined,
    head_count: isLivestockCycle ? Number(livestock_head_count) : undefined,
    production_purpose: isLivestockCycle ? livestock_purposes : undefined,
    management_system: isLivestockCycle ? livestock_management : undefined,
    crop: isLivestockCycle
      ? {
          id: `livestock-${livestock_species.toLowerCase()}`,
          name: livestock_species,
          category: 'Livestock Cycle',
          default_unit: 'heads',
        }
      : selected_crop,
  };

  return {
    isValid: errors.length === 0,
    errors,
    season,
  };
}

// --------------------------------------------------------------------------
// TEST SUITE: Farm Registration Multi-Livestock & Enterprise 'Both'
// --------------------------------------------------------------------------
test('Farm Registration: successfully allows multi-selection of livestock species', () => {
  const result = buildFarmPayload({
    name: 'Bong Integrated Animal Hub',
    farmer_id: 'FARM-001',
    county: 'Bong',
    district: 'Jorquelleh',
    community: 'Gbarnga',
    size: 15,
    farming_type: 'livestock',
    selected_animals: ['Goats', 'Chickens', 'Pigs'],
    breed: 'West African Dwarf, Broiler, Large White',
    head_count: 85,
    production_purposes: ['Meat production', 'Egg production', 'Breeding'],
    management_system: 'Semi-intensive',
  });

  assert.equal(result.isValid, true);
  assert.equal(result.farm.livestock_details.selected_animals.length, 3);
  assert.deepEqual(result.farm.livestock_details.selected_animals, ['Goats', 'Chickens', 'Pigs']);
  assert.equal(result.farm.livestock_details.animal_type, 'Goats, Chickens, Pigs');
  assert.equal(result.farm.livestock_details.head_count, 85);
});

test('Farm Registration: enterprise "both" captures both livestock and crops', () => {
  const result = buildFarmPayload({
    name: 'Nimba Agro-Pastoral Estate',
    farmer_id: 'FARM-002',
    county: 'Nimba',
    district: 'Sanniquellie-Mahn',
    community: 'Sanniquellie',
    size: 25,
    farming_type: 'both',
    selected_animals: ['Cow', 'Sheep'],
    selected_crops: ['Coffee', 'Rice', 'Cassava'],
    breed: 'Ndama, Djallonke',
    head_count: 40,
    production_purposes: ['Meat production', 'Milk production'],
    management_system: 'Free-range',
  });

  assert.equal(result.isValid, true);
  assert.equal(result.farm.farming_type, 'both');
  assert.deepEqual(result.farm.selected_crops, ['Coffee', 'Rice', 'Cassava']);
  assert.deepEqual(result.farm.livestock_details.selected_animals, ['Cow', 'Sheep']);
  assert.equal(result.farm.livestock_details.head_count, 40);
});

test('Farm Registration: validates missing livestock species in livestock or both mode', () => {
  const result = buildFarmPayload({
    name: 'Invalid Farm',
    farmer_id: 'FARM-003',
    county: 'Margibi',
    district: 'Kakata',
    community: 'Kakata Central',
    size: 5,
    farming_type: 'livestock',
    selected_animals: [],
    head_count: 10,
    production_purposes: ['Meat production'],
  });

  assert.equal(result.isValid, false);
  assert.ok(result.errors.includes('At least one livestock animal species required'));
});

// --------------------------------------------------------------------------
// TEST SUITE: New Season Creation (Livestock vs Crops Dynamic Cycle)
// --------------------------------------------------------------------------
test('New Season: selecting a livestock farm automatically generates a Livestock Production Cycle', () => {
  const livestockFarm = {
    id: 'farm-live-01',
    name: 'Margibi Goat Ranch',
    farming_type: 'livestock',
    size: 10,
    livestock_details: {
      selected_animals: ['Goats'],
      animal_type: 'Goats',
      breed: 'West African Dwarf',
      head_count: 35,
      production_purpose: ['Meat production', 'Breeding'],
      management_system: 'Semi-intensive',
    },
  };

  const result = buildSeasonPayload({
    farm: livestockFarm,
    cycle_type: 'livestock',
    livestock_species: 'Goats',
    livestock_breed: 'West African Dwarf',
    livestock_head_count: 35,
    livestock_purposes: ['Meat production', 'Breeding'],
    livestock_management: 'Semi-intensive',
    season_name: '2026 Goats Production Cycle',
    planting_date: '2026-06-01',
    harvest_date: '2026-12-15',
  });

  assert.equal(result.isValid, true);
  assert.equal(result.season.cycle_type, 'livestock');
  assert.equal(result.season.crop_id, 'livestock-goats');
  assert.equal(result.season.livestock_type, 'Goats');
  assert.equal(result.season.head_count, 35);
  assert.equal(result.season.crop.category, 'Livestock Cycle');
  assert.equal(result.season.crop.default_unit, 'heads');
});

test('New Season: integrated farm ("both") can activate either a Crop Season or Livestock Cycle', () => {
  const integratedFarm = {
    id: 'farm-both-01',
    name: 'Lofa Diversified Farm',
    farming_type: 'both',
    size: 18,
    livestock_details: {
      selected_animals: ['Chickens', 'Pigs'],
      animal_type: 'Chickens, Pigs',
      head_count: 120,
    },
  };

  // 1. Activate Crop Season on integrated farm
  const coffeeCrop = CROPS_CATALOGUE.find((c) => c.name === 'Coffee');
  const cropResult = buildSeasonPayload({
    farm: integratedFarm,
    cycle_type: 'crops',
    selected_crop: { id: 'crop-coffee', name: 'Coffee', category: 'Cash Crop', default_unit: 'kg' },
    crop_variety: 'Liberica Indigenous',
    season_name: '2026 Coffee (Liberica Indigenous) Season',
    planting_date: '2026-05-15',
    harvest_date: '2026-11-20',
    cultivated_area: 8.5,
  });

  assert.equal(cropResult.isValid, true);
  assert.equal(cropResult.season.cycle_type, 'crops');
  assert.equal(cropResult.season.crop.name, 'Coffee');
  assert.equal(cropResult.season.cultivated_area, 8.5);

  // 2. Activate Livestock Cycle on integrated farm
  const livestockResult = buildSeasonPayload({
    farm: integratedFarm,
    cycle_type: 'livestock',
    livestock_species: 'Chickens',
    livestock_breed: 'Broiler',
    livestock_head_count: 120,
    livestock_purposes: ['Meat production', 'Egg production'],
    livestock_management: 'Intensive',
    season_name: '2026 Chickens Production Cycle',
    planting_date: '2026-06-01',
    harvest_date: '2026-08-30',
  });

  assert.equal(livestockResult.isValid, true);
  assert.equal(livestockResult.season.cycle_type, 'livestock');
  assert.equal(livestockResult.season.crop_id, 'livestock-chickens');
  assert.equal(livestockResult.season.head_count, 120);
});

test('New Season: Coffee crop is present with Liberica Indigenous and Robusta varieties', () => {
  const coffee = CROPS_CATALOGUE.find((c) => c.name === 'Coffee');
  assert.ok(coffee, 'Coffee should exist in crops catalogue');
  assert.equal(coffee.code, 'COFF');
  assert.ok(coffee.varieties.includes('Liberica Indigenous'));
  assert.ok(coffee.varieties.includes('Robusta'));
});
