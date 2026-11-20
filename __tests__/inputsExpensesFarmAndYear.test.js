const test = require('node:test');
const assert = require('node:assert/strict');

const CROPS_INPUT_CATEGORIES = [
  'Seeds & Seedlings',
  'Fertilizers & Nutrients',
  'Crop Protection',
  'Herbicides',
  'Tools & Implements',
  'Equipment & Machinery',
  'Other Crop Materials',
];

const LIVESTOCK_INPUT_CATEGORIES = [
  'Animal Feed & Nutrition',
  'Veterinary & Vaccines',
  'Livestock Mineral Licks & Supplements',
  'Livestock Housing Materials',
  'Tools & Implements',
  'Equipment & Machinery',
  'Other Livestock Materials',
];

const CROP_ONLY_INPUT_CATEGORIES = new Set([
  'Seeds & Seedlings',
  'Fertilizers & Nutrients',
  'Crop Protection',
  'Herbicides',
  'Seeds',
  'Fertilizers',
  'Pesticides',
  'Other Crop Materials',
]);

const LIVESTOCK_ONLY_INPUT_CATEGORIES = new Set([
  'Animal Feed & Nutrition',
  'Veterinary & Vaccines',
  'Livestock Mineral Licks & Supplements',
  'Livestock Housing Materials',
  'Other Livestock Materials',
]);

const CROPS_EXPENSE_CATEGORIES = [
  'Labour & Wages',
  'Land Preparation',
  'Seeds & Seedlings',
  'Fertilizer Application',
  'Pest & Weed Control',
  'Equipment Rental',
  'Transportation & Haulage',
  'Storage & Processing',
  'Irrigation & Water',
  'Other Crop Operations',
];

const LIVESTOCK_EXPENSE_CATEGORIES = [
  'Animal Feed & Care',
  'Veterinary Services',
  'Herd / Flock Vaccination',
  'Labour & Wages (Herd Management)',
  'Livestock Housing & Pen Maintenance',
  'Pasture & Grazing Maintenance',
  'Equipment Rental',
  'Transportation & Haulage',
  'Other Livestock Operations',
];

const CROP_ONLY_EXPENSE_CATEGORIES = new Set([
  'Land Preparation',
  'Land preparation',
  'Seeds & Seedlings',
  'Seeds',
  'Fertilizer Application',
  'Fertilizer',
  'Pest & Weed Control',
  'Pesticides',
  'Irrigation & Water',
  'Irrigation',
  'Other Crop Operations',
]);

const LIVESTOCK_ONLY_EXPENSE_CATEGORIES = new Set([
  'Animal Feed & Care',
  'Veterinary Services',
  'Herd / Flock Vaccination',
  'Livestock Housing & Pen Maintenance',
  'Pasture & Grazing Maintenance',
  'Labour & Wages (Herd Management)',
  'Other Livestock Operations',
]);

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
  if (!category) errors.push('Valid input category required');
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
  if (!category) errors.push('Valid expense category required');
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

function filterLedger(items, { farm_id, year, farmsMap }) {
  return items.filter((item) => {
    const matchFarm = !farm_id || farm_id === 'all' || item.farm_id === farm_id;
    const itemYear = (item.purchase_date || item.expense_date)?.substring(0, 4);
    const matchYear = !year || year === 'all' || itemYear === year;
    if (!matchFarm || !matchYear) return false;

    // Strict enterprise isolation
    if (farm_id && farm_id !== 'all' && farmsMap) {
      const farm = farmsMap.get(farm_id);
      if (farm?.farming_type === 'livestock') {
        // Exclude all crops data
        if (CROP_ONLY_INPUT_CATEGORIES.has(item.category)) return false;
        if (CROP_ONLY_EXPENSE_CATEGORIES.has(item.category)) return false;
      } else if (farm?.farming_type === 'crops') {
        // Exclude all livestock data
        if (LIVESTOCK_ONLY_INPUT_CATEGORIES.has(item.category)) return false;
        if (LIVESTOCK_ONLY_EXPENSE_CATEGORIES.has(item.category)) return false;
      }
    }

    return true;
  });
}

// --------------------------------------------------------------------------
// TEST SUITE: Farm Selection for Inputs & Inventory
// --------------------------------------------------------------------------
test('Inputs & Inventory: successfully captures inventory with farm parcel selection', () => {
  const farmA = { id: 'farm-001', name: 'Gbehley Swamp Plot 1', farming_type: 'crops' };
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
  const livestockFarm = { id: 'farm-002', name: 'Margibi Goat Ranch', farming_type: 'livestock' };
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
// TEST SUITE: Enterprise Strict Isolation (Livestock vs. Crops)
// --------------------------------------------------------------------------
test('Enterprise Isolation: clicking a livestock farm excludes all crops data and shows only livestock items', () => {
  const farmsMap = new Map([
    ['farm-live', { id: 'farm-live', name: 'Margibi Livestock Hub', farming_type: 'livestock' }],
    ['farm-crop', { id: 'farm-crop', name: 'Bong Rice Field', farming_type: 'crops' }],
  ]);

  const mixedInputs = [
    { id: '1', farm_id: 'farm-live', category: 'Animal Feed & Nutrition', name: 'Goat Concentrates', purchase_date: '2026-02-10' },
    { id: '2', farm_id: 'farm-live', category: 'Veterinary & Vaccines', name: 'Anthrax Vaccine', purchase_date: '2026-03-15' },
    { id: '3', farm_id: 'farm-live', category: 'Seeds & Seedlings', name: 'Unrelated Crop Seed', purchase_date: '2026-01-05' }, // stray crop record
    { id: '4', farm_id: 'farm-live', category: 'Tools & Implements', name: 'Hoes and Feed Buckets', purchase_date: '2026-02-12' },
  ];

  const filtered = filterLedger(mixedInputs, { farm_id: 'farm-live', year: 'all', farmsMap });

  // Seeds & Seedlings must be excluded from livestock farm
  assert.equal(filtered.length, 3);
  const categories = filtered.map((i) => i.category);
  assert.ok(!categories.includes('Seeds & Seedlings'), 'Crops data must not be included on livestock farm');
  assert.ok(categories.includes('Animal Feed & Nutrition'));
  assert.ok(categories.includes('Veterinary & Vaccines'));
  assert.ok(categories.includes('Tools & Implements'));
});

test('Enterprise Isolation: clicking a crop farm excludes all livestock data and shows only crops items', () => {
  const farmsMap = new Map([
    ['farm-live', { id: 'farm-live', name: 'Margibi Livestock Hub', farming_type: 'livestock' }],
    ['farm-crop', { id: 'farm-crop', name: 'Bong Rice Field', farming_type: 'crops' }],
  ]);

  const mixedExpenses = [
    { id: 'e1', farm_id: 'farm-crop', category: 'Labour & Wages', description: 'Swamp weeding wages', expense_date: '2026-04-10' },
    { id: 'e2', farm_id: 'farm-crop', category: 'Land Preparation', description: 'Tillage and harrowing', expense_date: '2026-03-01' },
    { id: 'e3', farm_id: 'farm-crop', category: 'Fertilizer Application', description: 'NPK spreading', expense_date: '2026-04-20' },
    { id: 'e4', farm_id: 'farm-crop', category: 'Animal Feed & Care', description: 'Stray livestock cost', expense_date: '2026-04-25' }, // stray livestock record
  ];

  const filtered = filterLedger(mixedExpenses, { farm_id: 'farm-crop', year: 'all', farmsMap });

  // Animal Feed & Care must be excluded from crops farm
  assert.equal(filtered.length, 3);
  const categories = filtered.map((e) => e.category);
  assert.ok(!categories.includes('Animal Feed & Care'), 'Livestock data must not be included on crop farm');
  assert.ok(categories.includes('Labour & Wages'));
  assert.ok(categories.includes('Land Preparation'));
  assert.ok(categories.includes('Fertilizer Application'));
});

test('Year & Farm Filtering: accurately isolates records for specific farm and past year', () => {
  const inputsMock = [
    { id: '1', farm_id: 'farm-A', purchase_date: '2026-05-01', cost: 100, currency: 'USD', category: 'Tools & Implements' },
    { id: '2', farm_id: 'farm-A', purchase_date: '2025-06-15', cost: 250, currency: 'USD', category: 'Tools & Implements' },
    { id: '3', farm_id: 'farm-B', purchase_date: '2025-08-20', cost: 300, currency: 'USD', category: 'Tools & Implements' },
    { id: '4', farm_id: 'farm-A', purchase_date: '2024-04-10', cost: 180, currency: 'USD', category: 'Tools & Implements' },
  ];

  const farmA_2025 = filterLedger(inputsMock, { farm_id: 'farm-A', year: '2025' });
  assert.equal(farmA_2025.length, 1);
  assert.equal(farmA_2025[0].id, '2');
  assert.equal(farmA_2025[0].cost, 250);

  const farmA_All = filterLedger(inputsMock, { farm_id: 'farm-A', year: 'all' });
  assert.equal(farmA_All.length, 3);

  const allFarms_2025 = filterLedger(inputsMock, { farm_id: 'all', year: '2025' });
  assert.equal(allFarms_2025.length, 2);
  const total2025Cost = allFarms_2025.reduce((sum, item) => sum + item.cost, 0);
  assert.equal(total2025Cost, 550);
});
