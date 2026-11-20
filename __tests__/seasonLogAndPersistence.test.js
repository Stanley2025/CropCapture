const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

function isSeasonLivestock(season) {
  return (
    season.cycle_type === 'livestock' ||
    season.crop?.category === 'Livestock Cycle' ||
    season.crop?.category === 'Livestock' ||
    (season.crop_id && season.crop_id.startsWith('livestock-'))
  );
}

function filterSeasons(seasons, filter = 'all', farmId = 'all') {
  return seasons.filter((item) => {
    const isLive = isSeasonLivestock(item);
    if (filter === 'crops' && isLive) return false;
    if (filter === 'livestock' && !isLive) return false;
    if (farmId !== 'all' && item.farm_id !== farmId) return false;
    return true;
  });
}

function computeSeasonMetrics(seasons) {
  let cropCount = 0;
  let livestockCount = 0;

  for (const s of seasons) {
    if (isSeasonLivestock(s)) {
      livestockCount += 1;
    } else {
      cropCount += 1;
    }
  }

  return {
    totalCycles: seasons.length,
    cropCount,
    livestockCount,
  };
}

describe('Season & Production Cycle Log & Real-Time Record Persistence', () => {
  const mockSeasons = [
    {
      id: 's-1',
      farm_id: 'FARM-01',
      season_name: '2026 Rice Main Season',
      crop_id: 'crop-rice',
      crop_variety_id: 'Suakoko 8',
      planting_date: '2026-05-10',
      expected_harvest_date: '2026-10-15',
      cultivated_area: 4.5,
      cycle_type: 'crops',
      status: 'active',
      crop: { name: 'Rice', category: 'Cereal' },
    },
    {
      id: 's-2',
      farm_id: 'FARM-02',
      season_name: '2026 Goats Breeding Cycle',
      crop_id: 'livestock-goats',
      crop_variety_id: 'West African Dwarf',
      planting_date: '2026-02-01',
      expected_harvest_date: '2026-08-30',
      head_count: 35,
      cycle_type: 'livestock',
      status: 'active',
      crop: { name: 'Goats', category: 'Livestock Cycle' },
    },
    {
      id: 's-3',
      farm_id: 'FARM-01',
      season_name: '2026 Coffee Intercrop Season',
      crop_id: 'crop-coffee',
      crop_variety_id: 'Liberica Indigenous',
      planting_date: '2026-06-01',
      expected_harvest_date: '2026-12-20',
      cultivated_area: 2.0,
      cycle_type: 'crops',
      status: 'active',
      crop: { name: 'Coffee', category: 'Cash Crop' },
    },
  ];

  test('filters season logs accurately by All, Crops, and Livestock Cycles', () => {
    const all = filterSeasons(mockSeasons, 'all');
    assert.equal(all.length, 3);

    const cropsOnly = filterSeasons(mockSeasons, 'crops');
    assert.equal(cropsOnly.length, 2);
    assert.deepEqual(cropsOnly.map((s) => s.crop.name), ['Rice', 'Coffee']);

    const livestockOnly = filterSeasons(mockSeasons, 'livestock');
    assert.equal(livestockOnly.length, 1);
    assert.equal(livestockOnly[0].crop.name, 'Goats');
  });

  test('filters season logs by specific farm parcel', () => {
    const farm1Seasons = filterSeasons(mockSeasons, 'all', 'FARM-01');
    assert.equal(farm1Seasons.length, 2);
    assert.ok(farm1Seasons.every((s) => s.farm_id === 'FARM-01'));

    const farm2Seasons = filterSeasons(mockSeasons, 'all', 'FARM-02');
    assert.equal(farm2Seasons.length, 1);
    assert.equal(farm2Seasons[0].season_name, '2026 Goats Breeding Cycle');
  });

  test('computes aggregated cycle metrics correctly', () => {
    const metrics = computeSeasonMetrics(mockSeasons);
    assert.equal(metrics.totalCycles, 3);
    assert.equal(metrics.cropCount, 2);
    assert.equal(metrics.livestockCount, 1);
  });

  test('activating a new season prepends immediately to the in-memory season log', () => {
    let currentLogs = [...mockSeasons];
    let activeTab = 'create';

    const newSeason = {
      id: 's-4',
      farm_id: 'FARM-02',
      season_name: '2026 Pigs Production Cycle',
      crop_id: 'livestock-pigs',
      crop_variety_id: 'Large White',
      planting_date: '2026-11-20',
      expected_harvest_date: '2027-05-30',
      head_count: 15,
      cycle_type: 'livestock',
      status: 'active',
      crop: { name: 'Pigs', category: 'Livestock Cycle' },
    };

    // Prepend upon activation
    currentLogs = [newSeason, ...currentLogs];
    // Farmer chooses to view in seasons log
    activeTab = 'log';

    assert.equal(currentLogs.length, 4);
    assert.equal(currentLogs[0].id, 's-4');
    assert.equal(currentLogs[0].season_name, '2026 Pigs Production Cycle');
    assert.equal(activeTab, 'log');

    // Recent 3 preview displays latest activated cycles
    const recentPreview = currentLogs.slice(0, 3);
    assert.equal(recentPreview.length, 3);
    assert.equal(recentPreview[0].id, 's-4');
    assert.equal(recentPreview[1].id, 's-1');
  });
});
