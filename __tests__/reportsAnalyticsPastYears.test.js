const test = require('node:test');
const assert = require('node:assert/strict');

// Logic extracted from app/reports/index.tsx for multi-year filtering and analytics

function extractYear(dateStr) {
  if (!dateStr) return null;
  const match = String(dateStr).match(/^(\d{4})/);
  if (match) return parseInt(match[1], 10);
  const d = new Date(dateStr);
  return isNaN(d.getFullYear()) ? null : d.getFullYear();
}

function discoverAvailableYears(records, baselineYears = [2026, 2025, 2024, 2023, 2022, 2021]) {
  const yearSet = new Set(baselineYears);
  records.forEach((r) => {
    const y = extractYear(r.date || r.harvest_date || r.activity_date || r.created_at);
    if (y) yearSet.add(y);
  });
  return Array.from(yearSet).sort((a, b) => b - a);
}

function filterRecordsByYearAndFarmer({
  currentFarmerId,
  selectedYear,
  selectedFarmId = 'all',
  farms = [],
  harvests = [],
  seasons = [],
  activities = [],
  expenses = [],
  inputs = [],
}) {
  // 1. Isolate to current farmer's parcels
  const farmerFarms = farms.filter((f) => f.farmer_id === currentFarmerId);
  const myFarmIds = new Set(farmerFarms.map((f) => f.id));

  // 2. Filter by farm selection
  const activeFarms =
    selectedFarmId === 'all'
      ? farmerFarms
      : farmerFarms.filter((f) => f.id === selectedFarmId);
  const activeFarmIds = new Set(activeFarms.map((f) => f.id));

  // 3. Year filter predicate
  const matchesYear = (dateStr) => {
    if (selectedYear === 'all') return true;
    return extractYear(dateStr) === Number(selectedYear);
  };

  const filteredHarvests = harvests.filter(
    (h) =>
      (myFarmIds.has(h.farm_id) || h.farmer_id === currentFarmerId) &&
      (selectedFarmId === 'all' || activeFarmIds.has(h.farm_id)) &&
      matchesYear(h.harvest_date || h.created_at)
  );

  const filteredSeasons = seasons.filter(
    (s) =>
      myFarmIds.has(s.farm_id) &&
      (selectedFarmId === 'all' || activeFarmIds.has(s.farm_id)) &&
      matchesYear(s.planting_date || s.created_at)
  );

  const filteredActivities = activities.filter(
    (a) =>
      (myFarmIds.has(a.farm_id) || a.farmer_id === currentFarmerId) &&
      (selectedFarmId === 'all' || activeFarmIds.has(a.farm_id)) &&
      matchesYear(a.activity_date || a.created_at)
  );

  const filteredExpenses = expenses.filter(
    (e) =>
      myFarmIds.has(e.farm_id) &&
      (selectedFarmId === 'all' || activeFarmIds.has(e.farm_id)) &&
      matchesYear(e.expense_date || e.created_at)
  );

  const filteredInputs = inputs.filter(
    (i) =>
      myFarmIds.has(i.farm_id) &&
      (selectedFarmId === 'all' || activeFarmIds.has(i.farm_id)) &&
      matchesYear(i.purchase_date || i.created_at)
  );

  const totalHarvestKg = filteredHarvests.reduce(
    (acc, h) => acc + (Number(h.quantity) || 0),
    0
  );
  const totalActivityCost = filteredActivities.reduce(
    (acc, a) => acc + (Number(a.cost) || 0),
    0
  );
  const totalInputCost = filteredInputs.reduce(
    (acc, i) => acc + (Number(i.cost) || 0),
    0
  );
  const totalDirectExpense = filteredExpenses
    .filter((e) => e.currency === 'USD')
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const grandTotalCost = totalActivityCost + totalInputCost + totalDirectExpense;

  return {
    filteredHarvests,
    filteredSeasons,
    filteredActivities,
    filteredExpenses,
    filteredInputs,
    totalHarvestKg,
    grandTotalCost,
  };
}

function calculateYoYComparison(currentYield, priorYield, currentCost, priorCost) {
  const yieldChangePct =
    priorYield > 0
      ? Math.round(((currentYield - priorYield) / priorYield) * 100)
      : null;
  const costChangePct =
    priorCost > 0
      ? Math.round(((currentCost - priorCost) / priorCost) * 100)
      : null;
  return { yieldChangePct, costChangePct };
}

// ==========================================
// TEST SUITES
// ==========================================

test('Multi-Year Analytics: extractYear parses ISO strings and YYYY-MM-DD accurately', () => {
  assert.strictEqual(extractYear('2025-06-15'), 2025);
  assert.strictEqual(extractYear('2024-11-20T14:32:00.000Z'), 2024);
  assert.strictEqual(extractYear('2026-01-01'), 2026);
  assert.strictEqual(extractYear(null), null);
  assert.strictEqual(extractYear(''), null);
});

test('Multi-Year Analytics: Discovering available years includes historical baseline and recorded years', () => {
  const sampleRecords = [
    { harvest_date: '2023-04-10' },
    { activity_date: '2025-08-15' },
    { created_at: '2020-03-01T00:00:00Z' }, // older historical year
  ];

  const years = discoverAvailableYears(sampleRecords);
  assert.ok(years.includes(2026), 'Includes current 2026 cycle');
  assert.ok(years.includes(2025), 'Includes 2025');
  assert.ok(years.includes(2024), 'Includes 2024 baseline');
  assert.ok(years.includes(2023), 'Includes 2023');
  assert.ok(years.includes(2020), 'Includes dynamically discovered 2020');
  assert.strictEqual(years[0] >= years[1], true, 'Years are sorted descending');
});

test('Multi-Year Analytics: Selecting past year 2025 isolates only 2025 farm information', () => {
  const farmerId = 'f-001';
  const farms = [{ id: 'farm-01', farmer_id: farmerId, name: 'Gbehley Farm' }];

  const harvests = [
    { id: 'h-1', farm_id: 'farm-01', farmer_id: farmerId, quantity: 1500, harvest_date: '2026-05-10' },
    { id: 'h-2', farm_id: 'farm-01', farmer_id: farmerId, quantity: 2800, harvest_date: '2025-09-12' },
    { id: 'h-3', farm_id: 'farm-01', farmer_id: farmerId, quantity: 2200, harvest_date: '2025-11-04' },
    { id: 'h-4', farm_id: 'farm-01', farmer_id: farmerId, quantity: 3100, harvest_date: '2024-10-20' },
  ];

  const activities = [
    { id: 'a-1', farm_id: 'farm-01', farmer_id: farmerId, cost: 200, activity_date: '2026-03-01' },
    { id: 'a-2', farm_id: 'farm-01', farmer_id: farmerId, cost: 350, activity_date: '2025-04-15' },
  ];

  const res2025 = filterRecordsByYearAndFarmer({
    currentFarmerId: farmerId,
    selectedYear: '2025',
    farms,
    harvests,
    activities,
  });

  assert.strictEqual(res2025.filteredHarvests.length, 2, 'Exactly 2 harvests in 2025');
  assert.strictEqual(res2025.totalHarvestKg, 5000, 'Sum of 2025 harvests is 5000 kg (2800 + 2200)');
  assert.strictEqual(res2025.filteredActivities.length, 1, 'Exactly 1 activity in 2025');
  assert.strictEqual(res2025.grandTotalCost, 350, 'Cost in 2025 is $350');
});

test('Multi-Year Analytics: All Years mode aggregates lifetime records across all cycles', () => {
  const farmerId = 'f-001';
  const farms = [{ id: 'farm-01', farmer_id: farmerId, name: 'Gbehley Farm' }];

  const harvests = [
    { id: 'h-1', farm_id: 'farm-01', farmer_id: farmerId, quantity: 1500, harvest_date: '2026-05-10' },
    { id: 'h-2', farm_id: 'farm-01', farmer_id: farmerId, quantity: 2800, harvest_date: '2025-09-12' },
    { id: 'h-3', farm_id: 'farm-01', farmer_id: farmerId, quantity: 2200, harvest_date: '2025-11-04' },
    { id: 'h-4', farm_id: 'farm-01', farmer_id: farmerId, quantity: 3100, harvest_date: '2024-10-20' },
  ];

  const resAll = filterRecordsByYearAndFarmer({
    currentFarmerId: farmerId,
    selectedYear: 'all',
    farms,
    harvests,
  });

  assert.strictEqual(resAll.filteredHarvests.length, 4, 'Includes all 4 historical harvests');
  assert.strictEqual(resAll.totalHarvestKg, 9600, 'Cumulative harvest is 9,600 kg');
});

test('Multi-Year Analytics: Strict multi-tenant isolation prevents seeing other farmers past records', () => {
  const farmer1 = 'f-001';
  const farmer2 = 'f-002';

  const farms = [
    { id: 'farm-01', farmer_id: farmer1, name: "Farmer 1's Farm" },
    { id: 'farm-02', farmer_id: farmer2, name: "Farmer 2's Farm" },
  ];

  const harvests = [
    { id: 'h-1', farm_id: 'farm-01', farmer_id: farmer1, quantity: 1000, harvest_date: '2025-05-10' },
    { id: 'h-2', farm_id: 'farm-02', farmer_id: farmer2, quantity: 9999, harvest_date: '2025-05-10' },
  ];

  const resFarmer1 = filterRecordsByYearAndFarmer({
    currentFarmerId: farmer1,
    selectedYear: '2025',
    farms,
    harvests,
  });

  assert.strictEqual(resFarmer1.filteredHarvests.length, 1);
  assert.strictEqual(resFarmer1.totalHarvestKg, 1000, 'Farmer 1 only sees their own 1000 kg harvest, not Farmer 2');
});

test('Multi-Year Analytics: Year-over-Year (YoY) comparison computes correct percentage trends', () => {
  // Yield increased from 4000 kg (2024) to 5000 kg (2025): +25%
  // Cost decreased from $500 (2024) to $400 (2025): -20%
  const yoy = calculateYoYComparison(5000, 4000, 400, 500);

  assert.strictEqual(yoy.yieldChangePct, 25, 'Yield increased +25%');
  assert.strictEqual(yoy.costChangePct, -20, 'Cost decreased -20%');

  // Baseline with no prior year data returns null
  const yoyNoPrior = calculateYoYComparison(5000, 0, 400, 0);
  assert.strictEqual(yoyNoPrior.yieldChangePct, null);
  assert.strictEqual(yoyNoPrior.costChangePct, null);
});

test('Multi-Year Analytics: Empty past years return zero metrics without runtime errors', () => {
  const farmerId = 'f-001';
  const farms = [{ id: 'farm-01', farmer_id: farmerId, name: 'Gbehley Farm' }];

  const res2022 = filterRecordsByYearAndFarmer({
    currentFarmerId: farmerId,
    selectedYear: '2022',
    farms,
    harvests: [],
    activities: [],
    expenses: [],
    inputs: [],
  });

  assert.strictEqual(res2022.filteredHarvests.length, 0);
  assert.strictEqual(res2022.totalHarvestKg, 0);
  assert.strictEqual(res2022.grandTotalCost, 0);
});
