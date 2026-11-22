'use strict';
/**
 * Shared farm-record domain logic.
 *
 * Plain CommonJS so it can be used by BOTH:
 *   - the Expo / React Native app (Metro bundles CommonJS fine; types in farmRecords.d.ts)
 *   - the Node USSD server (server/) and node:test unit tests
 *
 * Anything that defines what a farm / season / harvest / expense row looks like,
 * how references are generated, or how profit is estimated belongs here so the
 * two channels (App and USSD) cannot drift apart.
 */

// ---------------------------------------------------------------------------
// Reference data (mirrors supabase/seed.sql: fixed crop UUIDs)
// ---------------------------------------------------------------------------
const CROPS = [
  { id: '11111111-1111-1111-1111-111111111101', name: 'Rice', code: 'RICE', default_unit: 'kg', category: 'Cereal / Staple' },
  { id: '11111111-1111-1111-1111-111111111102', name: 'Cassava', code: 'CASS', default_unit: 'kg', category: 'Root / Tuber' },
  { id: '11111111-1111-1111-1111-111111111103', name: 'Maize', code: 'MAIZ', default_unit: 'kg', category: 'Cereal' },
  { id: '11111111-1111-1111-1111-111111111104', name: 'Cocoa', code: 'COCO', default_unit: 'kg', category: 'Cash Crop' },
  { id: '11111111-1111-1111-1111-111111111105', name: 'Coffee', code: 'COFF', default_unit: 'kg', category: 'Cash Crop' },
  { id: '11111111-1111-1111-1111-111111111106', name: 'Pepper', code: 'PEPP', default_unit: 'kg', category: 'Horticulture' },
  { id: '11111111-1111-1111-1111-111111111107', name: 'Plantain', code: 'PLAN', default_unit: 'bunches', category: 'Fruit / Staple' },
  { id: '11111111-1111-1111-1111-111111111108', name: 'Sweet Potato', code: 'SPOT', default_unit: 'kg', category: 'Root / Tuber' },
  { id: '11111111-1111-1111-1111-111111111109', name: 'Vegetables', code: 'VEG', default_unit: 'kg', category: 'Horticulture' },
  { id: '11111111-1111-1111-1111-111111111110', name: 'Oil Palm', code: 'PALM', default_unit: 'tonnes', category: 'Perennial Oil' },
];

function findCropById(id) {
  return CROPS.find((c) => c.id === id) || null;
}

// The 15 counties of Liberia with centroid coordinates.
const LIBERIA_COUNTIES = [
  { name: 'Bomi', code: 'BOM', latitude: 6.758, longitude: -10.845 },
  { name: 'Bong', code: 'BON', latitude: 7.004, longitude: -9.472 },
  { name: 'Gbarpolu', code: 'GBA', latitude: 7.495, longitude: -10.08 },
  { name: 'Grand Bassa', code: 'GBS', latitude: 6.231, longitude: -9.816 },
  { name: 'Grand Cape Mount', code: 'GCM', latitude: 7.047, longitude: -11.071 },
  { name: 'Grand Gedeh', code: 'GGD', latitude: 5.922, longitude: -8.222 },
  { name: 'Grand Kru', code: 'GKR', latitude: 4.754, longitude: -8.222 },
  { name: 'Lofa', code: 'LOF', latitude: 8.191, longitude: -9.723 },
  { name: 'Margibi', code: 'MAR', latitude: 6.515, longitude: -10.305 },
  { name: 'Maryland', code: 'MRY', latitude: 4.724, longitude: -7.717 },
  { name: 'Montserrado', code: 'MON', latitude: 6.444, longitude: -10.655 },
  { name: 'Nimba', code: 'NIM', latitude: 6.842, longitude: -8.66 },
  { name: 'River Gee', code: 'RGE', latitude: 5.26, longitude: -7.664 },
  { name: 'Rivercess', code: 'RIV', latitude: 5.904, longitude: -9.456 },
  { name: 'Sinoe', code: 'SIN', latitude: 5.25, longitude: -8.66 },
];

/** Lower-case county name -> coordinates (plus the common "rivercess" spelling). */
const COUNTY_COORDINATES = LIBERIA_COUNTIES.reduce(
  (acc, c) => {
    acc[c.name.toLowerCase()] = { latitude: c.latitude, longitude: c.longitude };
    return acc;
  },
  { 'river cess': { latitude: 5.904, longitude: -9.456 } }
);

function findCounty(name) {
  const key = String(name || '').trim().toLowerCase();
  return LIBERIA_COUNTIES.find((c) => c.name.toLowerCase() === key) || null;
}

/**
 * Simple expense categories offered on USSD, mapped onto the app's existing
 * category vocabulary (see CROPS_EXPENSE_CATEGORIES in app/inputs-expenses.tsx).
 */
const SIMPLE_EXPENSE_CATEGORIES = [
  { key: 'seeds', label: 'Seeds', category: 'Seeds & Seedlings' },
  { key: 'labour', label: 'Labour', category: 'Labour & Wages' },
  { key: 'fertilizer', label: 'Fertilizer', category: 'Fertilizer Application' },
  { key: 'transport', label: 'Transport', category: 'Transportation & Haulage' },
  { key: 'other', label: 'Other', category: 'Other Crop Operations' },
];

// ---------------------------------------------------------------------------
// Farm registration options (single source of truth for the app AND USSD).
// `value` is what is stored in the database; `label` is the short text shown on USSD.
// ---------------------------------------------------------------------------
const opt = (value, label) => ({ value, label: label || value });

const SOIL_TYPES = [
  'Clay Loam (Swamp Basin)',
  'Sandy Clay Loam',
  'Alluvial Deposit',
  'Red Lateritic Soil',
  'Sandy Loam',
  'Gravelly Loam',
  'Peat / Organic Muck',
];
const TENURE_TYPES = [
  'Family Customary Land',
  'Freehold / Titled Deed',
  'Leasehold Agreement',
  'Community Communal Land',
  'Sharecropping / Tenant',
];
const WATER_SOURCES = ['Well', 'Hand pump', 'River or stream', 'Borehole', 'Rainwater', 'Pipe-borne water'];
const HOUSING_TYPES = [
  'Raised Slatted Wooden Pen',
  'Concrete Block Shed',
  'Open Kraal / Fenced Paddock',
  'Poultry Coop / Run',
  'Thatched Enclosure',
  'Deep Litter House',
];
const GRAZING_ARRANGEMENTS = [
  'Communal Village Pasture',
  'Private Fenced Pasture',
  'Rotational Grazing Paddock',
  'Roadside / Bush Tethering',
  'Zero-Grazing (Cut-and-Carry)',
];
const FEEDING_SYSTEMS = [
  'Commercial Formulated Feed',
  'Cut Forage, Napier Grass & Legumes',
  'Natural Pasture Grazing Only',
  'Mixed Feeding (Pasture + Concentrates)',
  'Cassava Peels, Rice Bran & Farm Waste',
];
const PRODUCTION_PURPOSES = ['Meat production', 'Egg production', 'Milk production', 'Breeding'];
const MANAGEMENT_SYSTEMS = ['Free-range', 'Semi-intensive', 'Intensive'];
const LIVESTOCK_ANIMALS = [
  { label: 'Goats', defaultBreed: 'West African Dwarf' },
  { label: 'Pigs', defaultBreed: 'Large White / Landrace' },
  { label: 'Sheep', defaultBreed: 'Djallonke (West African Dwarf)' },
  { label: 'Chickens', defaultBreed: 'Local / Broiler / Layer' },
  { label: 'Cow', defaultBreed: 'Ndama / Muturu' },
];
const FARMING_TYPES = [opt('crops', 'Crops'), opt('livestock', 'Livestock'), opt('both', 'Crops + livestock')];
const SIZE_UNITS = [opt('acres', 'Acres'), opt('hectares', 'Hectares')];

/** Short USSD labels, index-aligned with the full lists above. */
const FARM_OPTIONS = {
  farmingTypes: FARMING_TYPES,
  sizeUnits: SIZE_UNITS,
  soilTypes: SOIL_TYPES.map((v, i) => opt(v, ['Clay loam (swamp)', 'Sandy clay loam', 'Alluvial', 'Red lateritic', 'Sandy loam', 'Gravelly loam', 'Peat / organic'][i])),
  tenureTypes: TENURE_TYPES.map((v, i) => opt(v, ['Family customary', 'Freehold / deed', 'Leasehold', 'Community land', 'Sharecropping'][i])),
  waterSources: WATER_SOURCES.map((v) => opt(v)),
  housingTypes: HOUSING_TYPES.map((v, i) => opt(v, ['Raised wooden pen', 'Concrete shed', 'Open kraal/paddock', 'Poultry coop', 'Thatched pen', 'Deep litter house'][i])),
  grazingArrangements: GRAZING_ARRANGEMENTS.map((v, i) => opt(v, ['Communal pasture', 'Private fenced', 'Rotational paddock', 'Roadside tethering', 'Zero-grazing'][i])),
  feedingSystems: FEEDING_SYSTEMS.map((v, i) => opt(v, ['Commercial feed', 'Cut forage & legumes', 'Pasture only', 'Pasture + feed', 'Cassava peels/bran'][i])),
  productionPurposes: PRODUCTION_PURPOSES.map((v, i) => opt(v, ['Meat', 'Eggs', 'Milk', 'Breeding'][i])),
  managementSystems: MANAGEMENT_SYSTEMS.map((v) => opt(v)),
  animals: LIVESTOCK_ANIMALS.map((a) => opt(a.label)),
};

const DEFAULT_FARM_PHOTO =
  'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=80';
const DEFAULT_HARVEST_PHOTO =
  'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80';

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------
function generateUUID() {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Unified Official Batch ID Standard:
 * LR-[COUNTY 3]-[DISTRICT 3]-[CROP 4-6]-[YEAR 4]-[6-DIGIT-SEQ]
 * Example: LR-NIM-SAN-COCOA-2026-000124
 *
 * For offline creation before server synchronization, assigns a temporary pending reference:
 * PENDING-LR-[CROP]-[YEAR]-[HEX6]
 */
function generateBatchReference(cropCode, optionsOrSeq) {
  const year = new Date().getFullYear();
  const cleanCrop = (cropCode || 'GEN').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
  const opts = typeof optionsOrSeq === 'object' && optionsOrSeq ? optionsOrSeq : null;

  if (opts && opts.isOfflinePending) {
    const randomHex = Math.floor(100000 + Math.random() * 900000).toString(16).slice(0, 6).toUpperCase();
    return `PENDING-LR-${cleanCrop}-${year}-${randomHex}`;
  }

  const norm = (v) => (v || 'GEN').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X');
  const county = norm(opts && opts.countyCode);
  const district = norm(opts && opts.districtCode);

  const seq =
    typeof optionsOrSeq === 'number'
      ? optionsOrSeq
      : opts && opts.sequenceNum != null
      ? opts.sequenceNum
      : Math.floor(100000 + Math.random() * 900000);

  return `LR-${county}-${district}-${cleanCrop}-${year}-${String(seq).padStart(6, '0')}`;
}

/** QR verification token used by the public traceability passport. */
function generateQrToken() {
  return `cropcapture_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** 6-digit Farm ID, same format the app's registerFarmerAccount uses. */
function generateFarmerCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ---------------------------------------------------------------------------
// Phone numbers
// ---------------------------------------------------------------------------
/**
 * Normalise a Liberian phone number to its 9-digit national form so that
 * "+231776543210", "0776543210", "231-77-654-3210" and "+231-77-654-3210" all match.
 */
function normalizePhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('00231')) digits = digits.slice(5);
  else if (digits.startsWith('231') && digits.length > 9) digits = digits.slice(3);
  if (digits.startsWith('0') && digits.length === 10) digits = digits.slice(1);
  return digits;
}

function phonesMatch(a, b) {
  const na = normalizePhone(a);
  return na.length >= 7 && na === normalizePhone(b);
}

/** Format in the style already stored in public.farmers: +231-77-654-3210 */
function formatLiberianPhone(phone) {
  const n = normalizePhone(phone);
  if (n.length !== 9) return String(phone || '').trim();
  return `+231-${n.slice(0, 2)}-${n.slice(2, 5)}-${n.slice(5)}`;
}

// ---------------------------------------------------------------------------
// Profit estimation (previously duplicated inline in app/farm/[id].tsx and
// app/inputs-expenses.tsx)
// ---------------------------------------------------------------------------
/** Reference farm-gate rates (USD) used when a harvest has no recorded sale value. */
const REFERENCE_RATES_USD = { cropPerUnit: 0.45, livestockPerHead: 50 };

function isLivestockHarvest(h) {
  const unit = String((h && h.unit) || '').toLowerCase();
  const category = h && h.crop && h.crop.category;
  return Boolean(
    (h && h.animal_type) || category === 'Livestock Offtake' || unit.includes('head') || unit.includes('animal')
  );
}

/**
 * The harvest's value in US dollars: the recorded sale value if present, otherwise quantity x reference
 * rate. A sale value recorded in Liberian dollars is not a US dollar amount, so it counts as 0 here; see
 * harvestRevenueLRD().
 */
function estimateHarvestValue(h) {
  if (h && h.total_value && !isNaN(Number(h.total_value)) && Number(h.total_value) > 0) {
    return h.currency === 'LRD' ? 0 : Number(h.total_value);
  }
  const rate = isLivestockHarvest(h) ? REFERENCE_RATES_USD.livestockPerHead : REFERENCE_RATES_USD.cropPerUnit;
  return (Number(h && h.quantity) || 0) * rate;
}

function estimateHarvestRevenue(harvests) {
  return (harvests || []).reduce((sum, h) => sum + estimateHarvestValue(h), 0);
}

/** Sale value recorded in Liberian dollars. */
function harvestRevenueLRD(harvests) {
  return (harvests || []).reduce((sum, h) => (h && !h.deleted_at && h.currency === 'LRD' && Number(h.total_value) > 0 ? sum + Number(h.total_value) : sum), 0);
}

/**
 * Season summary used by the USSD "My farm summary" screen.
 * "Season" = calendar year, matching the app's year filter on reports/expenses.
 */
function summarizeSeason({ harvests = [], expenses = [], year = new Date().getFullYear() } = {}) {
  const y = String(year);
  const inYear = (d) => String(d || '').substring(0, 4) === y;
  const seasonHarvests = harvests.filter((h) => inYear(h.harvest_date || h.created_at));
  // Only USD expenses are summed; LRD entries would need an exchange rate.
  const seasonExpenses = expenses.filter(
    (e) => inYear(e.expense_date || e.created_at) && (e.currency || 'USD') === 'USD'
  );

  const byCropMap = new Map();
  for (const h of seasonHarvests) {
    const crop = findCropById(h.crop_id);
    const name = (h.crop && h.crop.name) || (crop && crop.name) || 'Other';
    const unit = h.unit || (crop && crop.default_unit) || 'kg';
    const key = `${name}|${unit}`;
    const prev = byCropMap.get(key) || { name, unit, quantity: 0 };
    prev.quantity += Number(h.quantity) || 0;
    byCropMap.set(key, prev);
  }

  const totalExpenses = seasonExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const estimatedRevenue = estimateHarvestRevenue(seasonHarvests);

  return {
    year: Number(y),
    byCrop: [...byCropMap.values()].sort((a, b) => b.quantity - a.quantity),
    totalExpenses,
    estimatedRevenue,
    net: estimatedRevenue - totalExpenses,
    harvestCount: seasonHarvests.length,
    expenseCount: seasonExpenses.length,
  };
}

// ---------------------------------------------------------------------------
// Record builders: canonical row shapes for public.* tables.
// These intentionally DO NOT set `source`; the database default ('app') applies
// for app writes, and the USSD repository adds source = 'ussd' explicitly.
// ---------------------------------------------------------------------------
const USSD_TAG = 'Recorded via USSD';

const todayISO = (now = new Date()) => now.toISOString().substring(0, 10);

function buildFarmerRecord({ fullName, phone, county, district, community, farmerCode, gender = null, dateOfBirth = null, now = new Date() }) {
  const ts = now.toISOString();
  return {
    id: generateUUID(),
    profile_id: null,
    farmer_id_code: farmerCode || generateFarmerCode(),
    full_name: String(fullName || '').trim(),
    gender: gender || null,
    date_of_birth: dateOfBirth || null,
    phone_number: formatLiberianPhone(phone),
    email: null,
    county,
    district: district || 'Not set',
    community: community || 'Not set',
    cooperative_id: null,
    created_at: ts,
    updated_at: ts,
  };
}

/** Livestock block stored in farms.livestock_details (same keys the app writes). */
function buildLivestockDetails(d) {
  const animals = d.animals || [];
  return {
    animal_type: animals.join(', '),
    selected_animals: animals,
    breed: d.breed ? String(d.breed).trim() || undefined : undefined,
    head_count: parseInt(d.headCount, 10),
    production_purpose: d.productionPurposes || [],
    management_system: d.managementSystem,
    housing_type: d.housingType,
    housing_size: d.housingSize ? String(d.housingSize).trim() || undefined : undefined,
    housing_capacity: d.housingCapacity ? parseInt(d.housingCapacity, 10) : undefined,
    grazing_availability: Boolean(d.grazingAvailable),
    grazing_arrangement: d.grazingAvailable ? d.grazingArrangement : undefined,
    grazing_area: d.grazingAvailable ? (d.grazingArea ? String(d.grazingArea).trim() || undefined : undefined) : undefined,
    water_source: d.waterSource,
    feeding_system: d.feedingSystem,
  };
}

/** Default farm description used when the farmer does not write one (identical in app and USSD). */
function describeFarm({ farmingType = 'crops', crops = [], animals = [], headCount, productionPurposes = [], managementSystem }) {
  if (farmingType === 'livestock') {
    return `${animals.join(' & ')} holding (${headCount || '0'} head) raised for ${productionPurposes.join(', ')} under ${managementSystem} management.`;
  }
  if (farmingType === 'both') {
    return `Integrated farm: Cultivating ${crops.join(', ') || 'crops'} and rearing ${animals.join(' & ')} (${headCount || '0'} head).`;
  }
  return `Crops parcel cultivating ${crops.join(', ') || 'crops'}.`;
}

/**
 * Canonical row for public.farms: exactly the fields the app's Register Farm screen saves.
 * Latitude/longitude default to the county centre when no GPS reading is available.
 */
function buildFarmRecord({
  farmerId, name, farmingType = 'crops', livestockDetails = null,
  county, district, countyId = null, districtId = null, community,
  size = 1, sizeUnit = 'acres', latitude, longitude,
  ownershipType = TENURE_TYPES[0], irrigation = false, soilType = null,
  description, crops = [], mainCropName, registrationDate, now = new Date(),
}) {
  const coords = COUNTY_COORDINATES[String(county || '').toLowerCase()] || {};
  const lat = latitude != null ? latitude : coords.latitude != null ? coords.latitude : null;
  const lng = longitude != null ? longitude : coords.longitude != null ? coords.longitude : null;
  const regDate = registrationDate || todayISO(now);
  const cropNames = crops.length ? crops : mainCropName ? [mainCropName] : [];
  const animals = livestockDetails ? livestockDetails.selected_animals || [] : [];
  return {
    id: generateUUID(),
    farmer_id: farmerId,
    name: String(name || '').trim(),
    farming_type: farmingType,
    livestock_details: livestockDetails,
    county,
    district: district || 'Not set',
    county_id: countyId,
    district_id: districtId,
    community: community || 'Not set',
    size: Number(size),
    size_unit: sizeUnit,
    latitude: lat,
    longitude: lng,
    ownership_type: ownershipType,
    irrigation: Boolean(irrigation),
    soil_type: soilType,
    photo_url: DEFAULT_FARM_PHOTO,
    description:
      description && String(description).trim()
        ? String(description).trim()
        : describeFarm({
            farmingType,
            crops: cropNames,
            animals,
            headCount: livestockDetails ? livestockDetails.head_count : undefined,
            productionPurposes: livestockDetails ? livestockDetails.production_purpose : [],
            managementSystem: livestockDetails ? livestockDetails.management_system : undefined,
          }),
    registration_date: regDate,
    is_active: true,
    created_at: `${regDate}T12:00:00.000Z`,
    updated_at: now.toISOString(),
  };
}

function buildSeasonRecord({ farmId, crop, cultivatedArea = 1, now = new Date() }) {
  const ts = now.toISOString();
  return {
    id: generateUUID(),
    farm_id: farmId,
    crop_id: crop.id,
    crop_variety_id: null,
    season_name: `${now.getFullYear()} ${crop.name} Season`,
    planting_date: todayISO(now),
    expected_harvest_date: null,
    cultivated_area: cultivatedArea,
    seed_quantity: null,
    status: 'active',
    created_at: ts,
    updated_at: ts,
  };
}

function buildHarvestRecord({ farmerId, farmId, seasonId = null, crop, quantity, unit, countyCode, storageLocation = '', observations, now = new Date() }) {
  const ts = now.toISOString();
  return {
    id: generateUUID(),
    batch_reference: generateBatchReference(crop.code, { countyCode }),
    farmer_id: farmerId,
    farm_id: farmId,
    season_id: seasonId,
    crop_id: crop.id,
    crop_variety_id: null,
    harvest_date: todayISO(now),
    quantity: Number(quantity),
    unit: unit || crop.default_unit || 'kg',
    storage_location: storageLocation,
    photo_url: DEFAULT_HARVEST_PHOTO,
    observations: observations || 'Harvest gathered and bagged in clean dry condition.',
    status: 'submitted',
    qr_token: generateQrToken(),
    created_at: ts,
    updated_at: ts,
  };
}

function buildExpenseRecord({ farmId, seasonId = null, category, amount, currency = 'USD', expenseDate, description, now = new Date() }) {
  return {
    id: generateUUID(),
    farm_id: farmId,
    season_id: seasonId,
    category,
    amount: Number(amount),
    currency,
    expense_date: expenseDate || todayISO(now),
    description: description || `${category}.`,
    created_at: now.toISOString(),
  };
}

/**
 * Channel label for a record. Uses the `source` column when the migration is
 * applied, otherwise falls back to the text marker the USSD channel writes.
 */
function recordSource(row) {
  const s = String((row && row.source) || '').toLowerCase();
  if (s === 'ussd') return 'USSD';
  if (s === 'seed') return 'Seed';
  if (s === 'app') return 'App';
  const text = `${(row && row.description) || ''} ${(row && row.observations) || ''}`;
  if (text.includes(USSD_TAG)) return 'USSD';
  if (text.includes('Demo seed data')) return 'Seed';
  return 'App';
}

module.exports = {
  CROPS,
  findCropById,
  LIBERIA_COUNTIES,
  COUNTY_COORDINATES,
  findCounty,
  SIMPLE_EXPENSE_CATEGORIES,
  SOIL_TYPES,
  TENURE_TYPES,
  WATER_SOURCES,
  HOUSING_TYPES,
  GRAZING_ARRANGEMENTS,
  FEEDING_SYSTEMS,
  PRODUCTION_PURPOSES,
  MANAGEMENT_SYSTEMS,
  LIVESTOCK_ANIMALS,
  FARM_OPTIONS,
  DEFAULT_FARM_PHOTO,
  DEFAULT_HARVEST_PHOTO,
  USSD_TAG,
  generateUUID,
  generateBatchReference,
  generateQrToken,
  generateFarmerCode,
  normalizePhone,
  phonesMatch,
  formatLiberianPhone,
  REFERENCE_RATES_USD,
  isLivestockHarvest,
  estimateHarvestValue,
  harvestRevenueLRD,
  estimateHarvestRevenue,
  summarizeSeason,
  buildFarmerRecord,
  buildLivestockDetails,
  describeFarm,
  buildFarmRecord,
  buildSeasonRecord,
  buildHarvestRecord,
  buildExpenseRecord,
  recordSource,
};
