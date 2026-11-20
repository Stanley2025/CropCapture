const { test, describe } = require('node:test');
const assert = require('node:assert');

/**
 * Tests for:
 * 1. Record Activity: livestock data vs crops data based on selected farm parcel
 * 2. Header: scanner icon removed on farmer portal
 * 3. Header: queue removed on farmer portal
 */

// Simulated constants and helper functions from RecordActivityScreen
const CROP_ACTIVITY_TYPES = [
  'Land preparation',
  'Planting',
  'Fertilizer application',
  'Pesticide application',
  'Weeding',
  'Irrigation',
  'Pest management',
  'Disease management',
  'Pruning',
  'Field inspection',
  'Harvest preparation',
  'Other crop activity',
];

const LIVESTOCK_ACTIVITY_TYPES = [
  'Feeding & Nutrition',
  'Veterinary Care & Vaccination',
  'Deworming & Parasite Treatment',
  'Pen Cleaning & Sanitation',
  'Water Supply & Maintenance',
  'Breeding & Insemination',
  'Birth / Kidding / Calving',
  'Milking & Dairy Handling',
  'Egg Collection & Packaging',
  'Clinical Health Inspection',
  'Animal Tagging & Identification',
  'Pasture & Grazing Management',
  'Quarantine & Isolation',
  'Other livestock operation',
];

const CROP_UNITS = ['kg', '50kg bags', 'liters', 'tonnes', 'bunches'];
const LIVESTOCK_UNITS = ['heads', 'doses', 'kg (feed)', 'bales', 'bags', 'litres', 'crates'];

function getActivityStateForFarm(farm, bothMode = 'crops', seasons = []) {
  const farmType = farm?.farming_type || 'crops';
  const isLivestock =
    farmType === 'livestock' || (farmType === 'both' && bothMode === 'livestock');

  const currentActivityTypes = isLivestock ? LIVESTOCK_ACTIVITY_TYPES : CROP_ACTIVITY_TYPES;
  const currentUnits = isLivestock ? LIVESTOCK_UNITS : CROP_UNITS;
  const defaultActivityType = isLivestock ? 'Feeding & Nutrition' : 'Land preparation';
  const defaultUnit = isLivestock ? 'heads' : 'kg';

  const availableSeasons = seasons.filter((s) => {
    if (s.farm_id !== farm.id) return false;
    if (isLivestock) {
      return s.cycle_type === 'livestock' || s.crop?.category === 'Livestock Cycle';
    } else {
      return s.cycle_type !== 'livestock';
    }
  });

  return {
    isLivestock,
    currentActivityTypes,
    currentUnits,
    defaultActivityType,
    defaultUnit,
    availableSeasons,
  };
}

// Simulated Header logic
function getHeaderRenderState({ currentRole, isOfflineMode, syncStatus, pendingSyncCount }) {
  const isFarmer = currentRole === 'farmer';

  const showScannerIcon = !isFarmer;
  const showQueueBadge = !isFarmer && pendingSyncCount > 0;

  // Sync Label logic
  let syncLabel = 'Online';
  if (isOfflineMode) {
    syncLabel = 'Offline';
  } else if (syncStatus === 'synchronizing') {
    syncLabel = 'Syncing...';
  } else if (isFarmer) {
    // For farmers, never show queue label
    syncLabel = 'Online';
  } else if (pendingSyncCount > 0) {
    syncLabel = `${pendingSyncCount} Queue`;
  }

  // Pill visibility: for farmers, only show when offline or actively syncing
  const showSyncPill = !isFarmer || isOfflineMode || syncStatus === 'synchronizing';

  return {
    isFarmer,
    showScannerIcon,
    showQueueBadge,
    syncLabel,
    showSyncPill,
  };
}

describe('Record Activity: Livestock vs Crops Data Adaptation', () => {
  const mockLivestockFarm = {
    id: 'farm-live-01',
    name: 'Gbarnga Goat Ranch',
    farming_type: 'livestock',
    livestock_details: { animal_type: 'Goats, Sheep' },
  };

  const mockCropsFarm = {
    id: 'farm-crop-01',
    name: 'Nimba Swamp Rice Plot',
    farming_type: 'crops',
    size: 4,
    size_unit: 'acres',
  };

  const mockIntegratedFarm = {
    id: 'farm-both-01',
    name: 'Kakata Integrated Holding',
    farming_type: 'both',
    livestock_details: { animal_type: 'Pigs' },
  };

  const mockSeasons = [
    {
      id: 'season-crop-1',
      farm_id: 'farm-crop-01',
      season_name: 'Main Rice Season 2026',
      cycle_type: 'crop',
    },
    {
      id: 'season-live-1',
      farm_id: 'farm-live-01',
      season_name: 'Goat Breeding Cycle 2026',
      cycle_type: 'livestock',
      crop: { category: 'Livestock Cycle' },
    },
    {
      id: 'season-both-crop',
      farm_id: 'farm-both-01',
      season_name: 'Cassava Cycle 2026',
      cycle_type: 'crop',
    },
    {
      id: 'season-both-live',
      farm_id: 'farm-both-01',
      season_name: 'Pig Fattening Batch A',
      cycle_type: 'livestock',
      crop: { category: 'Livestock Cycle' },
    },
  ];

  test('selecting a livestock farm shows livestock activities instead of crop activities', () => {
    const state = getActivityStateForFarm(mockLivestockFarm, 'crops', mockSeasons);

    assert.strictEqual(state.isLivestock, true);
    assert.strictEqual(state.defaultActivityType, 'Feeding & Nutrition');
    assert.strictEqual(state.defaultUnit, 'heads');

    // Must include livestock activities
    assert.ok(state.currentActivityTypes.includes('Feeding & Nutrition'));
    assert.ok(state.currentActivityTypes.includes('Veterinary Care & Vaccination'));
    assert.ok(state.currentActivityTypes.includes('Pen Cleaning & Sanitation'));
    assert.ok(state.currentActivityTypes.includes('Milking & Dairy Handling'));

    // Must NOT include crops activities
    assert.ok(!state.currentActivityTypes.includes('Land preparation'));
    assert.ok(!state.currentActivityTypes.includes('Weeding'));
    assert.ok(!state.currentActivityTypes.includes('Fertilizer application'));

    // Must only include livestock units
    assert.ok(state.currentUnits.includes('heads'));
    assert.ok(state.currentUnits.includes('doses'));
    assert.ok(state.currentUnits.includes('bales'));
  });

  test('selecting a livestock farm only brings livestock cycles and filters out crop seasons', () => {
    const state = getActivityStateForFarm(mockLivestockFarm, 'crops', mockSeasons);

    assert.strictEqual(state.availableSeasons.length, 1);
    assert.strictEqual(state.availableSeasons[0].season_name, 'Goat Breeding Cycle 2026');
    assert.strictEqual(state.availableSeasons[0].cycle_type, 'livestock');
  });

  test('selecting a crop farm brings only crops activities and crop seasons', () => {
    const state = getActivityStateForFarm(mockCropsFarm, 'crops', mockSeasons);

    assert.strictEqual(state.isLivestock, false);
    assert.strictEqual(state.defaultActivityType, 'Land preparation');
    assert.strictEqual(state.defaultUnit, 'kg');

    // Must include crop activities
    assert.ok(state.currentActivityTypes.includes('Land preparation'));
    assert.ok(state.currentActivityTypes.includes('Planting'));
    assert.ok(state.currentActivityTypes.includes('Weeding'));

    // Must NOT include livestock activities
    assert.ok(!state.currentActivityTypes.includes('Veterinary Care & Vaccination'));
    assert.ok(!state.currentActivityTypes.includes('Pen Cleaning & Sanitation'));

    // Available seasons must only be crop seasons
    assert.strictEqual(state.availableSeasons.length, 1);
    assert.strictEqual(state.availableSeasons[0].season_name, 'Main Rice Season 2026');
  });

  test('integrated farm ("both") dynamically switches between crop activities and livestock care', () => {
    // Mode: crops
    const cropModeState = getActivityStateForFarm(mockIntegratedFarm, 'crops', mockSeasons);
    assert.strictEqual(cropModeState.isLivestock, false);
    assert.strictEqual(cropModeState.availableSeasons[0].season_name, 'Cassava Cycle 2026');

    // Mode: livestock
    const liveModeState = getActivityStateForFarm(mockIntegratedFarm, 'livestock', mockSeasons);
    assert.strictEqual(liveModeState.isLivestock, true);
    assert.strictEqual(liveModeState.defaultActivityType, 'Feeding & Nutrition');
    assert.strictEqual(liveModeState.availableSeasons[0].season_name, 'Pig Fattening Batch A');
  });
});

describe('Farmer Portal Header: Scanner Icon & Queue Removal', () => {
  test('scanner icon is completely removed on farmer portal (currentRole === "farmer")', () => {
    const farmerHeader = getHeaderRenderState({
      currentRole: 'farmer',
      isOfflineMode: false,
      syncStatus: 'idle',
      pendingSyncCount: 3,
    });

    assert.strictEqual(farmerHeader.isFarmer, true);
    assert.strictEqual(farmerHeader.showScannerIcon, false, 'Scanner icon must not be rendered for farmers');
  });

  test('scanner icon is preserved for inspectors and other roles', () => {
    const inspectorHeader = getHeaderRenderState({
      currentRole: 'quality_inspector',
      isOfflineMode: false,
      syncStatus: 'idle',
      pendingSyncCount: 3,
    });

    assert.strictEqual(inspectorHeader.isFarmer, false);
    assert.strictEqual(inspectorHeader.showScannerIcon, true, 'Scanner icon must be rendered for inspectors');
  });

  test('queue label and queue badge are removed on farmer portal when pending records exist', () => {
    const farmerHeader = getHeaderRenderState({
      currentRole: 'farmer',
      isOfflineMode: false,
      syncStatus: 'idle',
      pendingSyncCount: 2, // 2 items waiting to sync
    });

    // Label must NOT say "2 Queue"
    assert.strictEqual(farmerHeader.syncLabel, 'Online');
    assert.strictEqual(farmerHeader.showQueueBadge, false, 'Queue badge must be hidden for farmers');
    assert.strictEqual(farmerHeader.showSyncPill, false, 'Queue indicator pill must be hidden when online for farmers');
  });

  test('inspector portal still displays queue pill and queue badge when pending records exist', () => {
    const inspectorHeader = getHeaderRenderState({
      currentRole: 'quality_inspector',
      isOfflineMode: false,
      syncStatus: 'idle',
      pendingSyncCount: 2,
    });

    assert.strictEqual(inspectorHeader.syncLabel, '2 Queue');
    assert.strictEqual(inspectorHeader.showQueueBadge, true);
    assert.strictEqual(inspectorHeader.showSyncPill, true);
  });

  test('farmer portal displays simple "Offline" pill when explicitly in offline mode without queue count', () => {
    const farmerOfflineHeader = getHeaderRenderState({
      currentRole: 'farmer',
      isOfflineMode: true,
      syncStatus: 'idle',
      pendingSyncCount: 5,
    });

    assert.strictEqual(farmerOfflineHeader.syncLabel, 'Offline');
    assert.strictEqual(farmerOfflineHeader.showSyncPill, true);
    assert.strictEqual(farmerOfflineHeader.showQueueBadge, false);
  });
});
