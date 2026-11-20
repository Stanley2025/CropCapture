const test = require('node:test');
const assert = require('node:assert/strict');

const CROP_UNITS = ['kg', 'tonnes', '50kg bags', 'bunches'];
const LIVESTOCK_UNITS = ['heads', 'animals', 'crates / trays', 'litres', 'kg (meat)'];

function detectHarvestEnterprise(selectedFarm, bothToggle = 'crops') {
  if (!selectedFarm) return { isLivestock: false, enterpriseType: 'crops', units: CROP_UNITS };

  const farmingType = selectedFarm.farming_type || 'crops';
  if (farmingType === 'livestock') {
    return {
      isLivestock: true,
      enterpriseType: 'livestock',
      units: LIVESTOCK_UNITS,
      defaultUnit: 'heads',
      defaultStorage: 'Farm Holding Paddock, Sanniquellie',
      animalType: selectedFarm.livestock_details?.animal_type || 'Livestock',
    };
  } else if (farmingType === 'crops') {
    return {
      isLivestock: false,
      enterpriseType: 'crops',
      units: CROP_UNITS,
      defaultUnit: 'kg',
      defaultStorage: 'Central Cooperative Warehouse, Sanniquellie',
    };
  } else {
    // Both
    const isLive = bothToggle === 'livestock';
    return {
      isLivestock: isLive,
      enterpriseType: 'both',
      activeMode: bothToggle,
      units: isLive ? LIVESTOCK_UNITS : CROP_UNITS,
      defaultUnit: isLive ? 'heads' : 'kg',
      defaultStorage: isLive ? 'Farm Holding Paddock, Sanniquellie' : 'Central Cooperative Warehouse, Sanniquellie',
      animalType: selectedFarm.livestock_details?.animal_type || 'Livestock',
    };
  }
}

function buildHarvestBatch({
  farm,
  farmer_id,
  bothToggle,
  quantity,
  unit,
  harvest_date,
  storage_location,
  observations,
}) {
  const errors = [];
  if (!farm || !farm.id) errors.push('Farm required');
  if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) errors.push('Valid quantity required');
  if (!harvest_date) errors.push('Harvest/offtake date required');

  const detection = detectHarvestEnterprise(farm, bothToggle);
  const animalType = farm?.livestock_details?.animal_type || 'Goats';

  const crop = detection.isLivestock
    ? {
        id: `livestock-${animalType.toLowerCase()}`,
        name: animalType,
        code: animalType.substring(0, 4).toUpperCase(),
        category: 'Livestock Offtake',
        default_unit: 'heads',
      }
    : {
        id: 'crop-rice',
        name: 'Rice',
        code: 'RICE',
        category: 'Cereal',
        default_unit: 'kg',
      };

  return {
    isValid: errors.length === 0,
    errors,
    detection,
    batch: {
      id: 'batch-' + Math.random().toString(36).substring(2, 8),
      batch_reference: `BATCH-${crop.code}-${Date.now()}`,
      farmer_id,
      farm_id: farm?.id,
      quantity: Number(quantity),
      unit: unit || detection.defaultUnit,
      harvest_date,
      storage_location: storage_location || detection.defaultStorage,
      observations,
      crop,
      status: 'submitted',
    },
  };
}

// --------------------------------------------------------------------------
// TEST SUITE: Harvest Farm Enterprise Detection
// --------------------------------------------------------------------------
test('Harvest: selecting a livestock farm automatically detects livestock offtake', () => {
  const livestockFarm = {
    id: 'farm-live-01',
    name: 'Margibi Goat Ranch',
    farming_type: 'livestock',
    livestock_details: {
      animal_type: 'Goats',
      head_count: 45,
    },
  };

  const detection = detectHarvestEnterprise(livestockFarm);
  assert.equal(detection.isLivestock, true);
  assert.equal(detection.enterpriseType, 'livestock');
  assert.equal(detection.defaultUnit, 'heads');
  assert.ok(detection.units.includes('heads'));
  assert.ok(detection.units.includes('animals'));
  assert.equal(detection.animalType, 'Goats');
});

test('Harvest: selecting a crops farm automatically detects crops harvest', () => {
  const cropFarm = {
    id: 'farm-crop-01',
    name: 'Gbehley Rice Swamp',
    farming_type: 'crops',
    size: 5,
  };

  const detection = detectHarvestEnterprise(cropFarm);
  assert.equal(detection.isLivestock, false);
  assert.equal(detection.enterpriseType, 'crops');
  assert.equal(detection.defaultUnit, 'kg');
  assert.ok(detection.units.includes('kg'));
  assert.ok(detection.units.includes('50kg bags'));
});

test('Harvest: integrated farm ("both") supports switching between Crop Harvest and Livestock Offtake', () => {
  const integratedFarm = {
    id: 'farm-both-01',
    name: 'Nimba Agro-Pastoral Farm',
    farming_type: 'both',
    livestock_details: {
      animal_type: 'Pigs & Chickens',
    },
  };

  // 1. In crops mode
  const cropDetect = detectHarvestEnterprise(integratedFarm, 'crops');
  assert.equal(cropDetect.isLivestock, false);
  assert.equal(cropDetect.defaultUnit, 'kg');

  // 2. In livestock mode
  const liveDetect = detectHarvestEnterprise(integratedFarm, 'livestock');
  assert.equal(liveDetect.isLivestock, true);
  assert.equal(liveDetect.defaultUnit, 'heads');
});

test('Harvest: builds valid livestock offtake batch with livestock metadata', () => {
  const livestockFarm = {
    id: 'farm-live-02',
    name: 'Bong Poultry Farm',
    farming_type: 'livestock',
    livestock_details: {
      animal_type: 'Chickens',
      head_count: 200,
    },
  };

  const result = buildHarvestBatch({
    farm: livestockFarm,
    farmer_id: 'FARMER-100',
    quantity: 50,
    unit: 'heads',
    harvest_date: '2026-06-15',
    storage_location: 'Central Paddock Holding Pen',
    observations: 'Healthy broiler flock offtake for market sale',
  });

  assert.equal(result.isValid, true);
  assert.equal(result.batch.crop.category, 'Livestock Offtake');
  assert.equal(result.batch.crop.name, 'Chickens');
  assert.equal(result.batch.unit, 'heads');
  assert.equal(result.batch.quantity, 50);
  assert.ok(result.batch.batch_reference.includes('CHIC'));
});

// --------------------------------------------------------------------------
// TEST SUITE: Inputs & Costs Production Year Dropdown Menu
// --------------------------------------------------------------------------
test('Production Year: dropdown menu state handles selecting specific year and "all"', () => {
  const availableYears = ['2026', '2025', '2024'];
  let selectedYear = 'all';

  function selectYear(yr) {
    if (yr === 'all' || availableYears.includes(yr)) {
      selectedYear = yr;
    }
  }

  selectYear('2025');
  assert.equal(selectedYear, '2025');

  selectYear('all');
  assert.equal(selectedYear, 'all');
});
