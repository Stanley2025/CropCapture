const test = require('node:test');
const assert = require('node:assert/strict');

const INPUT_CATEGORIES = [
  'Seeds & Seedlings',
  'Fertilizers & Nutrients',
  'Crop Protection',
  'Herbicides',
  'Animal Feed & Nutrition',
  'Veterinary & Vaccines',
  'Tools & Implements',
  'Equipment & Machinery',
  'Other Agricultural Materials',
];

const EXPENSE_CATEGORIES = [
  'Labour & Wages',
  'Land Preparation',
  'Seeds & Seedlings',
  'Fertilizer Application',
  'Pest & Weed Control',
  'Animal Feed & Care',
  'Veterinary Services',
  'Equipment Rental',
  'Transportation & Haulage',
  'Storage & Processing',
  'Irrigation & Water',
  'Other Operations',
];

function buildInputRecord({
  farm_id,
  name,
  category,
  quantity,
  unit,
  purchase_date,
  cost,
  currency,
  supplier,
  notes,
}) {
  const errors = [];
  if (!farm_id) errors.push('Farm parcel required');
  if (!name || !name.trim()) errors.push('Input name required');
  if (!category || !INPUT_CATEGORIES.includes(category)) errors.push('Valid input category required');
  if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) errors.push('Valid positive quantity required');
  if (cost === undefined || cost === null || isNaN(Number(cost)) || Number(cost) < 0) errors.push('Valid cost required');
  if (!purchase_date) errors.push('Purchase date required');

  const year = purchase_date ? purchase_date.substring(0, 4) : null;

  return {
    isValid: errors.length === 0,
    errors,
    record: {
      id: 'inp-' + Math.random().toString(36).substring(2, 9),
      farm_id,
      name: name?.trim(),
      category,
      quantity: Number(quantity),
      unit: unit || 'units',
      purchase_date,
      year,
      cost: Number(cost),
      currency: currency || 'USD',
      supplier: supplier || 'Local Agrodealer',
      notes,
    },
  };
}

function buildExpenseRecord({
  farm_id,
  category,
  amount,
  currency,
  expense_date,
  description,
}) {
  const errors = [];
  if (!farm_id) errors.push('Farm parcel required');
  if (!category || !EXPENSE_CATEGORIES.includes(category)) errors.push('Valid expense category required');
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) errors.push('Valid positive amount required');
  if (!expense_date) errors.push('Expense date required');

  const year = expense_date ? expense_date.substring(0, 4) : null;

  return {
    isValid: errors.length === 0,
    errors,
    record: {
      id: 'exp-' + Math.random().toString(36).substring(2, 9),
      farm_id,
      category,
      amount: Number(amount),
      currency: currency || 'USD',
      expense_date,
      year,
      description: description || `${category} operational expense`,
    },
  };
}

function filterLedger(items, { farm_id, year }) {
  return items.filter((item) => {
    const matchFarm = !farm_id || farm_id === 'all' || item.farm_id === farm_id;
    const itemYear = (item.purchase_date || item.expense_date)?.substring(0, 4);
    const matchYear = !year || year === 'all' || itemYear === year;
    return matchFarm && matchYear;
  });
}

// --------------------------------------------------------------------------
// TEST SUITE: Farm Selection for Inputs & Inventory
// --------------------------------------------------------------------------
test('Inputs & Inventory: successfully captures inventory with farm parcel selection', () => {
  const farmA = { id: 'farm-001', name: 'Gbehley Swamp Plot 1' };
  const result = buildInputRecord({
    farm_id: farmA.id,
    name: 'NPK 15-15-15 Compound Fertilizer',
    category: 'Fertilizers & Nutrients',
    quantity: 10,
    unit: 'bags',
    cost: 450,
    currency: 'USD',
    purchase_date: '2026-04-12',
    supplier: 'Gbarnga Agrovet Store',
    notes: 'Stored in main warehouse',
  });

  assert.equal(result.isValid, true);
  assert.equal(result.record.farm_id, 'farm-001');
  assert.equal(result.record.name, 'NPK 15-15-15 Compound Fertilizer');
  assert.equal(result.record.year, '2026');
  assert.equal(result.record.cost, 450);
  assert.equal(result.record.currency, 'USD');
});

test('Inputs & Inventory: captures livestock feed inventory on livestock farm', () => {
  const livestockFarm = { id: 'farm-002', name: 'Margibi Goat Ranch' };
  const result = buildInputRecord({
    farm_id: livestockFarm.id,
    name: 'Formulated Layer & Goat Concentrates',
    category: 'Animal Feed & Nutrition',
    quantity: 25,
    unit: 'bags',
    cost: 65000,
    currency: 'LRD',
    purchase_date: '2025-10-05',
    supplier: 'Monrovia Feed Mills',
  });

  assert.equal(result.isValid, true);
  assert.equal(result.record.farm_id, 'farm-002');
  assert.equal(result.record.category, 'Animal Feed & Nutrition');
  assert.equal(result.record.currency, 'LRD');
  assert.equal(result.record.year, '2025');
});

test('Inputs & Inventory: rejects record when farm parcel is not selected', () => {
  const result = buildInputRecord({
    farm_id: '',
    name: 'Rice Seed LAC 23',
    category: 'Seeds & Seedlings',
    quantity: 5,
    cost: 120,
    purchase_date: '2026-05-01',
  });

  assert.equal(result.isValid, false);
  assert.ok(result.errors.includes('Farm parcel required'));
});

// --------------------------------------------------------------------------
// TEST SUITE: Farm Expenses Selection & Logging
// --------------------------------------------------------------------------
test('Farm Expenses: logs operational expense with farm selection and dual currency', () => {
  const result = buildExpenseRecord({
    farm_id: 'farm-001',
    category: 'Labour & Wages',
    amount: 120,
    currency: 'USD',
    expense_date: '2026-05-18',
    description: 'Casual labor for swamp weeding (4 persons)',
  });

  assert.equal(result.isValid, true);
  assert.equal(result.record.farm_id, 'farm-001');
  assert.equal(result.record.category, 'Labour & Wages');
  assert.equal(result.record.amount, 120);
  assert.equal(result.record.year, '2026');
});

test('Farm Expenses: logs equipment rental in LRD for past year 2024', () => {
  const result = buildExpenseRecord({
    farm_id: 'farm-003',
    category: 'Equipment Rental',
    amount: 35000,
    currency: 'LRD',
    expense_date: '2024-03-20',
    description: 'Power tiller hire for land harrowing',
  });

  assert.equal(result.isValid, true);
  assert.equal(result.record.farm_id, 'farm-003');
  assert.equal(result.record.year, '2024');
  assert.equal(result.record.currency, 'LRD');
});

// --------------------------------------------------------------------------
// TEST SUITE: Year-Based and Farm-Based Ledger Filtering
// --------------------------------------------------------------------------
test('Year & Farm Filtering: accurately isolates records for specific farm and past year', () => {
  const inputsMock = [
    { id: '1', farm_id: 'farm-A', purchase_date: '2026-05-01', cost: 100, currency: 'USD' },
    { id: '2', farm_id: 'farm-A', purchase_date: '2025-06-15', cost: 250, currency: 'USD' },
    { id: '3', farm_id: 'farm-B', purchase_date: '2025-08-20', cost: 300, currency: 'USD' },
    { id: '4', farm_id: 'farm-A', purchase_date: '2024-04-10', cost: 180, currency: 'USD' },
  ];

  // Filter Farm A, Year 2025
  const farmA_2025 = filterLedger(inputsMock, { farm_id: 'farm-A', year: '2025' });
  assert.equal(farmA_2025.length, 1);
  assert.equal(farmA_2025[0].id, '2');
  assert.equal(farmA_2025[0].cost, 250);

  // Filter Farm A, All Years
  const farmA_All = filterLedger(inputsMock, { farm_id: 'farm-A', year: 'all' });
  assert.equal(farmA_All.length, 3);

  // Filter All Farms, Year 2025
  const allFarms_2025 = filterLedger(inputsMock, { farm_id: 'all', year: '2025' });
  assert.equal(allFarms_2025.length, 2);
  const total2025Cost = allFarms_2025.reduce((sum, item) => sum + item.cost, 0);
  assert.equal(total2025Cost, 550);
});
