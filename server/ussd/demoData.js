'use strict';
/**
 * Demo farmers for the USSD hackathon demo. Fixed UUIDs make the seed idempotent
 * and easy to clean up (`npm run ussd:seed -- --clean`).
 */
const { findCropById, findCounty, CROPS } = require('../../src/shared/farmRecords');

const SEED_TAG = 'Demo seed data';
const crop = (name) => CROPS.find((c) => c.name === name);

/** Phone used in the demo script to show first-time registration. Seed/clean removes it. */
const NEW_FARMER_DEMO_PHONE = '+231-77-100-0009';

/** Farmer that already exists in the app's Supabase data (created by the app, not the seed). */
const EXISTING_APP_FARMER = {
  id: 'f0000000-0000-0000-0000-000000000001',
  full_name: 'Emmanuel Gaye',
  phone_number: '+231-77-654-3210',
};

const DEMO_FARMERS = [
  {
    farmer: { id: 'd0000000-0000-4000-8000-000000000001', farmer_id_code: '700001', full_name: 'Musu Kollie', phone_number: '+231-77-100-0001', county: 'Bong', district: 'Suakoko', community: 'Gbarnga' },
    farms: [
      {
        id: 'd1000000-0000-4000-8000-000000000001', name: 'Kollie Rice Farm', size: 3, crop: 'Rice',
        harvests: [{ n: 1, qty: 450, daysAgo: 21 }, { n: 2, qty: 300, daysAgo: 6 }],
        expenses: [{ n: 1, category: 'Labour & Wages', amount: 60, daysAgo: 30 }, { n: 2, category: 'Seeds & Seedlings', amount: 35, daysAgo: 40 }, { n: 3, category: 'Fertilizer Application', amount: 80, daysAgo: 25 }],
      },
    ],
  },
  {
    farmer: { id: 'd0000000-0000-4000-8000-000000000002', farmer_id_code: '700002', full_name: 'Joseph Flomo', phone_number: '+231-88-100-0002', county: 'Lofa', district: 'Foya', community: 'Shelloe' },
    farms: [
      {
        id: 'd1000000-0000-4000-8000-000000000002', name: 'Flomo Cocoa Farm', size: 5, crop: 'Cocoa',
        harvests: [{ n: 3, qty: 620, daysAgo: 14 }],
        expenses: [{ n: 4, category: 'Transportation & Haulage', amount: 45, daysAgo: 12 }, { n: 5, category: 'Labour & Wages', amount: 120, daysAgo: 18 }],
      },
      {
        id: 'd1000000-0000-4000-8000-000000000003', name: 'Flomo Cassava Plot', size: 2, crop: 'Cassava',
        harvests: [{ n: 4, qty: 900, daysAgo: 9 }],
        expenses: [],
      },
    ],
  },
  {
    farmer: { id: 'd0000000-0000-4000-8000-000000000003', farmer_id_code: '700003', full_name: 'Comfort Doe', phone_number: '+231-77-100-0003', county: 'Nimba', district: 'Sanniquellie-Mahn', community: 'Gbehley' },
    farms: [
      {
        id: 'd1000000-0000-4000-8000-000000000004', name: 'Doe Vegetable Garden', size: 1.5, crop: 'Vegetables',
        harvests: [{ n: 5, qty: 180, daysAgo: 4 }],
        expenses: [{ n: 6, category: 'Seeds & Seedlings', amount: 20, daysAgo: 35 }, { n: 7, category: 'Fertilizer Application', amount: 25, daysAgo: 15 }],
      },
    ],
  },
];

const pad = (n) => String(n).padStart(12, '0');

/** Date N days ago, clamped to 1 Jan of the current year so seed data counts as "this season". */
function daysAgo(now, d) {
  const t = new Date(now.getTime() - d * 86400000);
  const jan1 = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 12));
  return t < jan1 ? jan1 : t;
}

/** Build table rows for the demo data. */
function buildDemoRows(now = new Date()) {
  const year = now.getUTCFullYear();
  const rows = { farmers: [], farms: [], farm_seasons: [], harvest_batches: [], expenses: [] };

  for (const { farmer, farms } of DEMO_FARMERS) {
    const created = daysAgo(now, 60).toISOString();
    rows.farmers.push({ ...farmer, profile_id: null, gender: null, date_of_birth: null, email: null, cooperative_id: null, created_at: created, updated_at: created });
    const county = findCounty(farmer.county);

    farms.forEach((f, i) => {
      const c = crop(f.crop);
      const farmCreated = daysAgo(now, 50 - i).toISOString();
      rows.farms.push({
        id: f.id, farmer_id: farmer.id, name: f.name, county: farmer.county, district: farmer.district, community: farmer.community,
        size: f.size, size_unit: 'acres', latitude: county.latitude, longitude: county.longitude, irrigation: false,
        description: `Crops parcel cultivating ${c.name}. ${SEED_TAG}.`, is_active: true, created_at: farmCreated, updated_at: farmCreated,
      });
      const seasonId = f.id.replace(/^d1/, 'd2');
      rows.farm_seasons.push({
        id: seasonId, farm_id: f.id, crop_id: c.id, crop_variety_id: null, season_name: `${year} ${c.name} Season`,
        planting_date: daysAgo(now, 45).toISOString().substring(0, 10), expected_harvest_date: null, cultivated_area: f.size,
        seed_quantity: null, status: 'active', created_at: farmCreated, updated_at: farmCreated,
      });
      for (const h of f.harvests) {
        const at = daysAgo(now, h.daysAgo);
        rows.harvest_batches.push({
          id: `d3000000-0000-4000-8000-${pad(h.n)}`, batch_reference: `LR-${county.code}-GEN-${c.code}-${year}-70000${h.n}`,
          farmer_id: farmer.id, farm_id: f.id, season_id: seasonId, crop_id: c.id, crop_variety_id: null,
          harvest_date: at.toISOString().substring(0, 10), quantity: h.qty, unit: c.default_unit, storage_location: '',
          observations: `Harvest gathered in good condition. ${SEED_TAG}.`, status: 'submitted', qr_token: `cropcapture_demo_seed_${h.n}`,
          created_at: at.toISOString(), updated_at: at.toISOString(),
        });
      }
      for (const e of f.expenses) {
        const at = daysAgo(now, e.daysAgo);
        rows.expenses.push({
          id: `d4000000-0000-4000-8000-${pad(e.n)}`, farm_id: f.id, season_id: seasonId, category: e.category, amount: e.amount,
          currency: 'USD', expense_date: at.toISOString().substring(0, 10), description: `${e.category}. ${SEED_TAG}.`, created_at: at.toISOString(),
        });
      }
    });
  }
  return rows;
}

/** Phone list shown in the simulator's phone picker. */
function demoPhoneList() {
  return [
    ...DEMO_FARMERS.map(({ farmer }) => ({ label: `${farmer.full_name} (demo)`, phone: farmer.phone_number })),
    { label: `${EXISTING_APP_FARMER.full_name} (app account)`, phone: EXISTING_APP_FARMER.phone_number },
    { label: 'New farmer (not registered)', phone: NEW_FARMER_DEMO_PHONE },
  ];
}

module.exports = {
  SEED_TAG,
  DEMO_FARMERS,
  EXISTING_APP_FARMER,
  NEW_FARMER_DEMO_PHONE,
  buildDemoRows,
  demoPhoneList,
  findCropById,
};
