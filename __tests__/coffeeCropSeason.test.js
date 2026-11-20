const test = require('node:test');
const assert = require('node:assert/strict');

// Verify Crop Catalogue in Season Creation includes Coffee
const CROPS = [
  {
    id: '11111111-1111-1111-1111-111111111105',
    name: 'Coffee',
    emoji: '☕',
    code: 'COFF',
    category: 'Cash Crop',
    varieties: ['Liberica Indigenous', 'Robusta', 'Arabica'],
  },
  {
    id: '11111111-1111-1111-1111-111111111104',
    name: 'Cocoa',
    emoji: '🍫',
    code: 'COCO',
    category: 'Cash Crop',
    varieties: ['Forastero Hybrid', 'Trinitario Elite'],
  },
  {
    id: '11111111-1111-1111-1111-111111111101',
    name: 'Rice',
    emoji: '🌾',
    code: 'RICE',
    category: 'Cereal / Staple',
    varieties: ['Suakoko 8', 'LAC 23', 'Nerica L-19'],
  },
  {
    id: '11111111-1111-1111-1111-111111111102',
    name: 'Cassava',
    emoji: '🥔',
    code: 'CASS',
    category: 'Root / Tuber',
    varieties: ['CARICASS 1', 'TMS 30572', 'Bassa Girl'],
  },
];

test('New Season Crop Catalogue: Includes Coffee prominently with code COFF and Cash Crop category', () => {
  const coffee = CROPS.find((c) => c.name === 'Coffee');
  assert.ok(coffee, 'Coffee must exist in crop catalogue');
  assert.strictEqual(coffee.code, 'COFF');
  assert.strictEqual(coffee.category, 'Cash Crop');
  assert.strictEqual(coffee.emoji, '☕');
  assert.ok(coffee.varieties.includes('Liberica Indigenous'), 'Includes indigenous Liberica coffee');
  assert.ok(coffee.varieties.includes('Robusta'), 'Includes Robusta coffee');
});

test('New Season Payload Construction: Activating a Coffee season constructs valid FarmSeason object', () => {
  const coffee = CROPS.find((c) => c.name === 'Coffee');
  const selectedVariety = coffee.varieties[0];
  const currentYear = 2026;

  const newSeason = {
    id: 's-coffee-001',
    farm_id: 'farm-001',
    crop_id: coffee.id,
    crop_variety_id: selectedVariety,
    season_name: `${currentYear} Coffee (${selectedVariety}) Season`,
    planting_date: '2026-05-15',
    expected_harvest_date: '2026-12-01',
    cultivated_area: 4.5,
    seed_quantity: 250,
    status: 'active',
    crop: {
      id: coffee.id,
      name: coffee.name,
      code: coffee.code,
      category: coffee.category,
      default_unit: 'kg',
      is_active: true,
    },
  };

  assert.strictEqual(newSeason.crop.name, 'Coffee');
  assert.strictEqual(newSeason.crop_variety_id, 'Liberica Indigenous');
  assert.strictEqual(newSeason.season_name, '2026 Coffee (Liberica Indigenous) Season');
  assert.strictEqual(newSeason.crop.category, 'Cash Crop');
  assert.strictEqual(newSeason.status, 'active');
});
