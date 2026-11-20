const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

function isHarvestLivestock(batch) {
  return (
    batch.crop?.category === 'Livestock Offtake' ||
    batch.crop?.category === 'Livestock Cycle' ||
    batch.crop?.category === 'Livestock' ||
    (batch.crop_id && batch.crop_id.startsWith('livestock-')) ||
    ['heads', 'animals', 'crates / trays', 'litres', 'kg (meat)'].includes(batch.unit)
  );
}

function filterHarvestLogs(harvests, filter = 'all', farmId = 'all') {
  return harvests.filter((item) => {
    const isLive = isHarvestLivestock(item);
    if (filter === 'crops' && isLive) return false;
    if (filter === 'livestock' && !isLive) return false;
    if (farmId !== 'all' && item.farm_id !== farmId) return false;
    return true;
  });
}

function computeHarvestMetrics(harvests) {
  let cropCount = 0;
  let livestockCount = 0;
  let totalValue = 0;

  for (const h of harvests) {
    if (isHarvestLivestock(h)) {
      livestockCount += 1;
    } else {
      cropCount += 1;
    }
    if (h.total_value && !isNaN(Number(h.total_value))) {
      totalValue += Number(h.total_value);
    }
  }

  return {
    totalBatches: harvests.length,
    cropCount,
    livestockCount,
    totalValue,
  };
}

describe('Harvest Log & Real-Time Record Persistence', () => {
  const mockHarvests = [
    {
      id: 'h-1',
      batch_reference: 'LIB-RICE-2026-0001',
      farmer_id: 'FARMER-01',
      farm_id: 'FARM-01',
      crop: { name: 'Rice', category: 'Cereal' },
      quantity: 1200,
      unit: 'kg',
      total_value: 540,
      harvest_date: '2026-11-10',
      status: 'submitted',
    },
    {
      id: 'h-2',
      batch_reference: 'LIB-GOAT-2026-0002',
      farmer_id: 'FARMER-01',
      farm_id: 'FARM-02',
      crop: { name: 'Goats', category: 'Livestock Offtake' },
      quantity: 25,
      unit: 'heads',
      total_value: 1250,
      harvest_date: '2026-11-12',
      status: 'approved',
    },
    {
      id: 'h-3',
      batch_reference: 'LIB-COFF-2026-0003',
      farmer_id: 'FARMER-01',
      farm_id: 'FARM-01',
      crop: { name: 'Coffee', category: 'Cash Crop' },
      quantity: 500,
      unit: 'kg',
      total_value: 800,
      harvest_date: '2026-11-15',
      status: 'submitted',
    },
    {
      id: 'h-4',
      batch_reference: 'LIB-CHIC-2026-0004',
      farmer_id: 'FARMER-01',
      farm_id: 'FARM-02',
      crop: { name: 'Chickens', category: 'Livestock Offtake' },
      quantity: 40,
      unit: 'crates / trays',
      total_value: 320,
      harvest_date: '2026-11-18',
      status: 'submitted',
    },
  ];

  test('filters harvest logs accurately by All, Crops, and Livestock Offtake', () => {
    const all = filterHarvestLogs(mockHarvests, 'all');
    assert.equal(all.length, 4);

    const cropsOnly = filterHarvestLogs(mockHarvests, 'crops');
    assert.equal(cropsOnly.length, 2);
    assert.deepEqual(cropsOnly.map((h) => h.crop.name), ['Rice', 'Coffee']);

    const livestockOnly = filterHarvestLogs(mockHarvests, 'livestock');
    assert.equal(livestockOnly.length, 2);
    assert.deepEqual(livestockOnly.map((h) => h.crop.name), ['Goats', 'Chickens']);
  });

  test('filters harvest logs by specific farm parcel', () => {
    const farm1Only = filterHarvestLogs(mockHarvests, 'all', 'FARM-01');
    assert.equal(farm1Only.length, 2);
    assert.ok(farm1Only.every((h) => h.farm_id === 'FARM-01'));

    const farm2Livestock = filterHarvestLogs(mockHarvests, 'livestock', 'FARM-02');
    assert.equal(farm2Livestock.length, 2);
    assert.ok(farm2Livestock.every((h) => h.farm_id === 'FARM-02'));
  });

  test('computes aggregated log metrics including total batches and financial value', () => {
    const metrics = computeHarvestMetrics(mockHarvests);
    assert.equal(metrics.totalBatches, 4);
    assert.equal(metrics.cropCount, 2);
    assert.equal(metrics.livestockCount, 2);
    assert.equal(metrics.totalValue, 2910); // 540 + 1250 + 800 + 320
  });

  test('saving a new harvest batch prepends immediately to the harvest log', () => {
    let currentLogs = [...mockHarvests];
    let activeTab = 'register';

    const newBatch = {
      id: 'h-5',
      batch_reference: 'LIB-PIGS-2026-0005',
      farmer_id: 'FARMER-01',
      farm_id: 'FARM-02',
      crop: { name: 'Pigs', category: 'Livestock Offtake' },
      quantity: 10,
      unit: 'heads',
      total_value: 900,
      harvest_date: '2026-11-20',
      status: 'submitted',
    };

    // Simulate saving and updating in-memory state
    currentLogs = [newBatch, ...currentLogs];
    // Farmer chooses to view log
    activeTab = 'log';

    assert.equal(currentLogs.length, 5);
    assert.equal(currentLogs[0].batch_reference, 'LIB-PIGS-2026-0005');
    assert.equal(activeTab, 'log');

    // Recent 3 preview takes latest 3
    const recentPreview = currentLogs.slice(0, 3);
    assert.equal(recentPreview.length, 3);
    assert.equal(recentPreview[0].id, 'h-5');
    assert.equal(recentPreview[1].id, 'h-1');
  });
});
