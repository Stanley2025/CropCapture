'use strict';
/**
 * Data access for FarmTori USSD and REST API channels.
 *
 * Two implementations with the same interface:
 *   - createSupabaseRepository: writes to the SAME Supabase tables the mobile app syncs to.
 *   - createMemoryRepository:   in-memory store for unit tests and an offline demo fallback.
 *
 * Row shapes come from src/shared/farmRecords.js (shared with the app); this layer
 * only persists them and tags them with `source`.
 */
const { phonesMatch, normalizePhone, findCropById, recordSource } = require('../../src/shared/farmRecords');
const { upsertDroppingMissingColumns } = require('../../src/shared/columnFallback');

const TABLES = ['farmers', 'farms', 'farm_seasons', 'harvest_batches', 'expenses', 'quality_inspections', 'farmer_pins'];

const { MAX_ATTEMPTS, LOCK_MINUTES } = require('./pin');

/** The next state of a PIN credential after one wrong try (a lock that has run out starts again from 0). */
function afterFailure(cred, now) {
  const expired = cred.locked_until && Date.parse(cred.locked_until) <= now.getTime();
  const attempts = (expired ? 0 : cred.failed_attempts || 0) + 1;
  const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + LOCK_MINUTES * 60000).toISOString() : null;
  return { failed_attempts: attempts, locked_until: lockedUntil, updated_at: now.toISOString() };
}

const byCreatedAsc = (a, b) => String(a.created_at).localeCompare(String(b.created_at));

function toActivity({ harvests, expenses, farms, limit }) {
  const items = [
    ...harvests.map((h) => {
      const crop = findCropById(h.crop_id);
      return {
        id: h.id, type: 'Harvest', created_at: h.created_at, source: recordSource(h),
        farmer: h.farmer_name || '', farm: h.farm_name || '',
        detail: `${crop ? crop.name : 'Crop'} ${Number(h.quantity)} ${h.unit || ''}`.trim(),
      };
    }),
    ...expenses.map((e) => ({
      id: e.id, type: 'Expense', created_at: e.created_at, source: recordSource(e),
      farmer: e.farmer_name || '', farm: e.farm_name || '',
      detail: `${e.category}: ${e.currency === 'LRD' ? 'L$' : '$'}${Number(e.amount)}`,
    })),
    ...farms.map((f) => ({
      id: f.id, type: 'Farm', created_at: f.created_at, source: recordSource(f),
      farmer: f.farmer_name || '', farm: f.name, detail: `Registered in ${f.county}`,
    })),
  ];
  return items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------
function createSupabaseRepository({ url, key, client } = {}) {
  let sb = client;
  if (!sb) {
    const { createClient } = require('@supabase/supabase-js');
    sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  // Columns the live database does not have (yet), per table. Learned from PostgREST errors,
  // so the server still works while some of the app's migrations are not applied.
  const missingColumns = new Map();

  const fail = (table, error) => {
    const err = new Error(`${table}: ${error.message}`);
    err.cause = error;
    return err;
  };

  /**
   * Upsert rows tagged with `source`. If the database rejects a column because it has not been
   * migrated yet, that column is dropped and the save retried (see src/shared/columnFallback.js).
   */
  async function write(table, rows, source) {
    const list = Array.isArray(rows) ? rows : [rows];
    if (list.length === 0) return list;
    const missing = missingColumns.get(table) || new Set();
    missingColumns.set(table, missing);
    const { error, rows: saved, dropped } = await upsertDroppingMissingColumns(
      (payload) => sb.from(table).upsert(payload, { onConflict: 'id' }),
      list.map((r) => ({ ...r, source })),
      missing
    );
    for (const col of dropped) {
      console.warn(`[ussd] ${table}.${col} is not in the database yet; saving without it (apply the pending migrations).`);
    }
    if (error) throw fail(table, error);
    return saved;
  }

  /** Columns currently being skipped (for the status endpoint and tests). */
  const skippedColumns = () => Object.fromEntries([...missingColumns].filter(([, v]) => v.size).map(([t, v]) => [t, [...v]]));

  async function select(table, build) {
    const { data, error } = await build(sb.from(table));
    if (error) throw fail(table, error);
    return data || [];
  }

  let pinsProbe = null;

  async function findFarmersByPhone(phone) {
    const n = normalizePhone(phone);
    if (n.length < 7) return [];
    // Narrow by the last 4 digits server-side, then match exactly on normalised digits.
    const rows = await select('farmers', (q) => q.select('*').ilike('phone_number', `%${n.slice(-4)}`));
    return rows.filter((f) => phonesMatch(f.phone_number, phone)).sort(byCreatedAsc);
  }

  return {
    kind: 'supabase',
    skippedColumns,
    async findFarmerByPhone(phone) {
      return (await findFarmersByPhone(phone))[0] || null;
    },
    findFarmersByPhone,
    getFarms: (farmerId) =>
      select('farms', (q) => q.select('*').eq('farmer_id', farmerId).order('created_at', { ascending: true })),
    getSeasons: (farmIds) =>
      farmIds.length ? select('farm_seasons', (q) => q.select('*').in('farm_id', farmIds)) : Promise.resolve([]),
    getHarvests: (farmerId) => select('harvest_batches', (q) => q.select('*').eq('farmer_id', farmerId)),
    getExpenses: (farmIds) =>
      farmIds.length ? select('expenses', (q) => q.select('*').in('farm_id', farmIds)) : Promise.resolve([]),
    createFarmer: (row) => write('farmers', row, 'ussd').then((r) => r[0]),
    createFarm: (row, source = 'ussd') => write('farms', row, source).then((r) => r[0]),
    createSeason: (row, source = 'ussd') => write('farm_seasons', row, source).then((r) => r[0]),
    createHarvest: (row, source = 'ussd') => write('harvest_batches', row, source).then((r) => r[0]),
    createExpense: (row, source = 'ussd') => write('expenses', row, source).then((r) => r[0]),
    createInspection: (row, source = 'rest_api') => write('quality_inspections', row, source).then((r) => r[0]),
    
    // PINs live in farmer_pins, a table the apps cannot read (row level security with no policy).
    // Everything here needs the SERVER key; with the app key it fails closed.
    async pinsAvailable() {
      if (!pinsProbe) {
        pinsProbe = Promise.resolve(sb.from('farmer_pins').select('farmer_id').limit(1)).then(
          ({ error }) => {
            if (error) console.warn(`[ussd] PINs are switched off: farmer_pins is not usable (${error.message}). Run the pending migration and use the service key.`);
            return !error;
          },
          () => false
        );
      }
      return pinsProbe;
    },
    async getPin(farmerId) {
      const rows = await select('farmer_pins', (q) => q.select('*').eq('farmer_id', farmerId).limit(1));
      return rows[0] || null;
    },
    async setPin(farmerId, pinHash, now = new Date()) {
      const { error } = await sb.from('farmer_pins').upsert(
        { farmer_id: farmerId, pin_hash: pinHash, failed_attempts: 0, locked_until: null, set_at: now.toISOString(), updated_at: now.toISOString() },
        { onConflict: 'farmer_id' }
      );
      if (error) throw fail('farmer_pins', error);
    },
    async recordPinFailure(farmerId, now = new Date()) {
      const cred = (await select('farmer_pins', (q) => q.select('*').eq('farmer_id', farmerId).limit(1)))[0];
      if (!cred) return { attempts: 0, lockedUntil: null };
      const next = afterFailure(cred, now);
      const { error } = await sb.from('farmer_pins').update(next).eq('farmer_id', farmerId);
      if (error) throw fail('farmer_pins', error);
      return { attempts: next.failed_attempts, lockedUntil: next.locked_until };
    },
    async clearPinFailures(farmerId, now = new Date()) {
      const { error } = await sb.from('farmer_pins').update({ failed_attempts: 0, locked_until: null, updated_at: now.toISOString() }).eq('farmer_id', farmerId);
      if (error) throw fail('farmer_pins', error);
    },

    // REST API Queries
    async getAllFarms({ farmerId, county, limit = 50 } = {}) {
      return select('farms', (q) => {
        let query = q.select('*, farmer:farmers!farms_farmer_id_fkey(full_name, phone_number)').order('created_at', { ascending: false }).limit(limit);
        if (farmerId) query = query.eq('farmer_id', farmerId);
        if (county) query = query.ilike('county', `%${county}%`);
        return query;
      });
    },
    async getAllHarvests({ farmId, farmerId, limit = 50 } = {}) {
      return select('harvest_batches', (q) => {
        let query = q.select('*, farm:farms!harvest_batches_farm_id_fkey(name, county), farmer:farmers!harvest_batches_farmer_id_fkey(full_name)').order('created_at', { ascending: false }).limit(limit);
        if (farmId) query = query.eq('farm_id', farmId);
        if (farmerId) query = query.eq('farmer_id', farmerId);
        return query;
      });
    },
    async getInspections({ batchId, limit = 50 } = {}) {
      return select('quality_inspections', (q) => {
        let query = q.select('*, batch:harvest_batches!quality_inspections_batch_id_fkey(*)').order('created_at', { ascending: false }).limit(limit);
        if (batchId) query = query.eq('batch_id', batchId);
        return query;
      });
    },
    async getVerification(token) {
      const batches = await select('harvest_batches', (q) =>
        q.select('*, farm:farms!harvest_batches_farm_id_fkey(name, county, district), farmer:farmers!harvest_batches_farmer_id_fkey(full_name, farmer_id_code)').or(`qr_token.eq.${token},id.eq.${token}`).limit(1)
      );
      if (!batches.length) return null;
      const batch = batches[0];
      const inspections = await select('quality_inspections', (q) =>
        q.select('*').eq('batch_id', batch.id).limit(1)
      ).catch(() => []);
      return {
        batch,
        inspection: inspections[0] || null,
        crop: findCropById(batch.crop_id),
        verified: true,
        verified_at: new Date().toISOString(),
      };
    },
    async getCommercialReport({ county } = {}) {
      const [farms, harvests, expenses] = await Promise.all([
        select('farms', (q) => (county ? q.select('*').ilike('county', `%${county}%`) : q.select('*'))),
        select('harvest_batches', (q) => q.select('*')),
        select('expenses', (q) => q.select('*')),
      ]);
      const totalArea = farms.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
      const totalProductionKg = harvests.reduce((sum, h) => sum + (Number(h.quantity) || 0), 0);
      const totalExpensesUsd = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const estimatedRevenueUsd = harvests.reduce((sum, h) => {
        const val = Number(h.total_value);
        return sum + (Number.isFinite(val) && val > 0 ? val : (Number(h.quantity) || 0) * 0.45);
      }, 0);
      return {
        county: county || 'All Liberia Counties',
        total_farms: farms.length,
        total_acreage: Math.round(totalArea * 100) / 100,
        total_production_kg: Math.round(totalProductionKg),
        total_expenses_usd: Math.round(totalExpensesUsd * 100) / 100,
        estimated_commercial_revenue_usd: Math.round(estimatedRevenueUsd * 100) / 100,
        net_commercial_margin_usd: Math.round((estimatedRevenueUsd - totalExpensesUsd) * 100) / 100,
        timestamp: new Date().toISOString(),
      };
    },

    /** Bulk upsert used by the seed script. */
    upsertRows: (table, rows, source) => write(table, rows, source),
    /** Deletes farmers; farms, seasons, harvests and expenses cascade via FKs. */
    async deleteFarmers(ids) {
      if (!ids.length) return;
      const { error } = await sb.from('farmers').delete().in('id', ids);
      if (error) throw fail('farmers', error);
    },
    async getRecentActivity(limit = 25) {
      const [harvests, expenses, farms] = await Promise.all([
        select('harvest_batches', (q) =>
          q
            .select('*, farmer:farmers!harvest_batches_farmer_id_fkey(full_name), farm:farms!harvest_batches_farm_id_fkey(name)')
            .order('created_at', { ascending: false })
            .limit(limit)
        ),
        select('expenses', (q) =>
          q
            .select('*, farm:farms!expenses_farm_id_fkey(name, farmer:farmers!farms_farmer_id_fkey(full_name))')
            .order('created_at', { ascending: false })
            .limit(limit)
        ),
        select('farms', (q) =>
          q
            .select('*, farmer:farmers!farms_farmer_id_fkey(full_name)')
            .order('created_at', { ascending: false })
            .limit(limit)
        ),
      ]);
      return toActivity({
        limit,
        harvests: harvests.map((h) => ({ ...h, farmer_name: h.farmer && h.farmer.full_name, farm_name: h.farm && h.farm.name })),
        expenses: expenses.map((e) => ({
          ...e,
          farm_name: e.farm && e.farm.name,
          farmer_name: e.farm && e.farm.farmer && e.farm.farmer.full_name,
        })),
        farms: farms.map((f) => ({ ...f, farmer_name: f.farmer && f.farmer.full_name })),
      });
    },
  };
}

// ---------------------------------------------------------------------------
// In-memory
// ---------------------------------------------------------------------------
function createMemoryRepository(initial = {}) {
  const db = Object.fromEntries(TABLES.map((t) => [t, (initial[t] || []).map((r) => ({ ...r }))]));
  const clone = (r) => (r ? { ...r } : r);

  function write(table, rows, source) {
    if (!db[table]) db[table] = [];
    const list = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ ...r, source }));
    for (const row of list) {
      const i = db[table].findIndex((r) => r.id === row.id);
      if (i >= 0) db[table][i] = row;
      else db[table].push(row);
    }
    return list.map(clone);
  }

  const findFarmersByPhone = async (phone) =>
    (db.farmers || []).filter((f) => phonesMatch(f.phone_number, phone)).sort(byCreatedAsc).map(clone);

  const farmById = (id) => (db.farms || []).find((f) => f.id === id);
  const farmerById = (id) => (db.farmers || []).find((f) => f.id === id);

  return {
    kind: 'memory',
    db,
    findFarmersByPhone,
    async findFarmerByPhone(phone) {
      return (await findFarmersByPhone(phone))[0] || null;
    },
    getFarms: async (farmerId) => (db.farms || []).filter((f) => f.farmer_id === farmerId).sort(byCreatedAsc).map(clone),
    getSeasons: async (farmIds) => (db.farm_seasons || []).filter((s) => farmIds.includes(s.farm_id)).map(clone),
    getHarvests: async (farmerId) => (db.harvest_batches || []).filter((h) => h.farmer_id === farmerId).map(clone),
    getExpenses: async (farmIds) => (db.expenses || []).filter((e) => farmIds.includes(e.farm_id)).map(clone),
    createFarmer: async (row) => write('farmers', row, 'ussd')[0],
    createFarm: async (row, source = 'ussd') => write('farms', row, source)[0],
    createSeason: async (row, source = 'ussd') => write('farm_seasons', row, source)[0],
    createHarvest: async (row, source = 'ussd') => write('harvest_batches', row, source)[0],
    createExpense: async (row, source = 'ussd') => write('expenses', row, source)[0],
    createInspection: async (row, source = 'rest_api') => write('quality_inspections', row, source)[0],

    async pinsAvailable() {
      return true;
    },
    async getPin(farmerId) {
      return clone((db.farmer_pins || []).find((c) => c.farmer_id === farmerId) || null);
    },
    async setPin(farmerId, pinHash, now = new Date()) {
      const row = { farmer_id: farmerId, pin_hash: pinHash, failed_attempts: 0, locked_until: null, set_at: now.toISOString(), updated_at: now.toISOString() };
      const i = db.farmer_pins.findIndex((c) => c.farmer_id === farmerId);
      if (i >= 0) db.farmer_pins[i] = row;
      else db.farmer_pins.push(row);
    },
    async recordPinFailure(farmerId, now = new Date()) {
      const cred = db.farmer_pins.find((c) => c.farmer_id === farmerId);
      if (!cred) return { attempts: 0, lockedUntil: null };
      Object.assign(cred, afterFailure(cred, now));
      return { attempts: cred.failed_attempts, lockedUntil: cred.locked_until };
    },
    async clearPinFailures(farmerId, now = new Date()) {
      const cred = db.farmer_pins.find((c) => c.farmer_id === farmerId);
      if (cred) Object.assign(cred, { failed_attempts: 0, locked_until: null, updated_at: now.toISOString() });
    },

    // REST API Queries
    async getAllFarms({ farmerId, county, limit = 50 } = {}) {
      let list = (db.farms || []).map(clone);
      if (farmerId) list = list.filter((f) => f.farmer_id === farmerId);
      if (county) list = list.filter((f) => f.county && f.county.toLowerCase().includes(county.toLowerCase()));
      return list.slice(0, limit).map((f) => ({
        ...f,
        farmer: { full_name: (farmerById(f.farmer_id) || {}).full_name, phone_number: (farmerById(f.farmer_id) || {}).phone_number },
      }));
    },
    async getAllHarvests({ farmId, farmerId, limit = 50 } = {}) {
      let list = (db.harvest_batches || []).map(clone);
      if (farmId) list = list.filter((h) => h.farm_id === farmId);
      if (farmerId) list = list.filter((h) => h.farmer_id === farmerId);
      return list.slice(0, limit).map((h) => ({
        ...h,
        farm: { name: (farmById(h.farm_id) || {}).name, county: (farmById(h.farm_id) || {}).county },
        farmer: { full_name: (farmerById(h.farmer_id) || {}).full_name },
      }));
    },
    async getInspections({ batchId, limit = 50 } = {}) {
      let list = (db.quality_inspections || []).map(clone);
      if (batchId) list = list.filter((i) => i.batch_id === batchId);
      return list.slice(0, limit);
    },
    async getVerification(token) {
      const batch = (db.harvest_batches || []).find((h) => h.qr_token === token || h.id === token);
      if (!batch) return null;
      const farm = farmById(batch.farm_id) || {};
      const farmer = farmerById(batch.farmer_id) || {};
      const inspection = (db.quality_inspections || []).find((i) => i.batch_id === batch.id) || null;
      return {
        batch: { ...batch, farm: { name: farm.name, county: farm.county, district: farm.district }, farmer: { full_name: farmer.full_name, farmer_id_code: farmer.farmer_id_code } },
        inspection,
        crop: findCropById(batch.crop_id),
        verified: true,
        verified_at: new Date().toISOString(),
      };
    },
    async getCommercialReport({ county } = {}) {
      let farms = db.farms || [];
      if (county) farms = farms.filter((f) => f.county && f.county.toLowerCase().includes(county.toLowerCase()));
      const harvests = db.harvest_batches || [];
      const expenses = db.expenses || [];
      const totalArea = farms.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
      const totalProductionKg = harvests.reduce((sum, h) => sum + (Number(h.quantity) || 0), 0);
      const totalExpensesUsd = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const estimatedRevenueUsd = harvests.reduce((sum, h) => {
        const val = Number(h.total_value);
        return sum + (Number.isFinite(val) && val > 0 ? val : (Number(h.quantity) || 0) * 0.45);
      }, 0);
      return {
        county: county || 'All Liberia Counties',
        total_farms: farms.length,
        total_acreage: Math.round(totalArea * 100) / 100,
        total_production_kg: Math.round(totalProductionKg),
        total_expenses_usd: Math.round(totalExpensesUsd * 100) / 100,
        estimated_commercial_revenue_usd: Math.round(estimatedRevenueUsd * 100) / 100,
        net_commercial_margin_usd: Math.round((estimatedRevenueUsd - totalExpensesUsd) * 100) / 100,
        timestamp: new Date().toISOString(),
      };
    },

    upsertRows: async (table, rows, source) => write(table, rows, source),
    async deleteFarmers(ids) {
      const farmIds = (db.farms || []).filter((f) => ids.includes(f.farmer_id)).map((f) => f.id);
      db.farmers = (db.farmers || []).filter((f) => !ids.includes(f.id));
      db.farmer_pins = (db.farmer_pins || []).filter((c) => !ids.includes(c.farmer_id));
      db.farms = (db.farms || []).filter((f) => !farmIds.includes(f.id));
      db.farm_seasons = (db.farm_seasons || []).filter((s) => !farmIds.includes(s.farm_id));
      db.expenses = (db.expenses || []).filter((e) => !farmIds.includes(e.farm_id));
      db.harvest_batches = (db.harvest_batches || []).filter((h) => !ids.includes(h.farmer_id));
      if (db.quality_inspections) db.quality_inspections = db.quality_inspections.filter((i) => !farmIds.includes(i.batch_id));
    },
    async getRecentActivity(limit = 25) {
      const name = (farmerId) => (farmerById(farmerId) || {}).full_name;
      return toActivity({
        limit,
        harvests: (db.harvest_batches || []).map((h) => ({ ...h, farmer_name: name(h.farmer_id), farm_name: (farmById(h.farm_id) || {}).name })),
        expenses: (db.expenses || []).map((e) => {
          const farm = farmById(e.farm_id) || {};
          return { ...e, farm_name: farm.name, farmer_name: name(farm.farmer_id) };
        }),
        farms: (db.farms || []).map((f) => ({ ...f, farmer_name: name(f.farmer_id) })),
      });
    },
  };
}

module.exports = { createSupabaseRepository, createMemoryRepository, TABLES };
