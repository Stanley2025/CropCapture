import { createClient } from '@/lib/supabase/client';
import {
  Farmer,
  Farm,
  Crop,
  CropVariety,
  FarmSeason,
  FarmActivity,
  HarvestBatch,
  QualityInspection,
  Cooperative,
  InputRecord,
  ExpenseRecord,
  AuditLog,
  Profile,
} from '@/types/database';

// ============================================================================
// High-Speed In-Memory Cache with Short TTL (3s) for Live Data
// ============================================================================
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const apiCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 3_000; // 3 seconds memory cache for near real-time updates

function getCached<T>(key: string): T | null {
  const entry = apiCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    apiCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  apiCache.set(key, { data, timestamp: Date.now() });
}

export function clearApiCache(): void {
  apiCache.clear();
}

/**
 * Timeout wrapper: Prevents frozen connections while allowing sufficient time for cloud queries
 */
async function withTimeout<T>(queryOrPromise: any, timeoutMs = 8000): Promise<T> {
  const promise = Promise.resolve(queryOrPromise);
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Database query timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// ============================================================================
// 1. DASHBOARD METRICS
// ============================================================================
export async function getDashboardMetrics() {
  const cacheKey = 'dashboard_metrics';
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const query = Promise.all([
      supabase.from('farmers').select('id', { count: 'exact', head: true }),
      supabase.from('farms').select('id, size', { count: 'exact' }),
      supabase.from('harvest_batches').select('id, status, quantity'),
      supabase.from('cooperatives').select('id', { count: 'exact', head: true }),
    ]);

    const [farmersRes, farmsRes, harvestsRes, coopsRes] = (await withTimeout(query, 8000)) as any[];

    if (!farmersRes.error) {
      const farms: any[] = farmsRes.data || [];
      const harvests: any[] = harvestsRes.data || [];
      const totalAcreage = farms.reduce((acc: number, f: any) => acc + (Number(f.size) || 0), 0);
      const totalHarvestKg = harvests.reduce((acc: number, h: any) => acc + (Number(h.quantity) || 0), 0);
      const pendingInspections = harvests.filter(
        (h: any) => h.status === 'submitted' || h.status === 'pending_inspection' || h.status === 'under_inspection'
      ).length;
      const approvedHarvests = harvests.filter((h: any) => h.status === 'approved').length;
      const rejectedHarvests = harvests.filter((h: any) => h.status === 'rejected').length;

      const result = {
        totalFarmers: farmersRes.count || 0,
        totalFarms: farmsRes.count || 0,
        totalAcreage,
        totalHarvestKg,
        pendingInspections,
        approvedHarvests,
        rejectedHarvests,
        totalCooperatives: coopsRes.count || 0,
        activeExtensionOfficers: 0,
      };

      setCache(cacheKey, result);
      return result;
    }
  } catch (e) {
    console.warn('Failed to load live dashboard metrics from Supabase:', e);
  }

  const emptyResult = {
    totalFarmers: 0,
    totalFarms: 0,
    totalAcreage: 0,
    totalHarvestKg: 0,
    pendingInspections: 0,
    approvedHarvests: 0,
    rejectedHarvests: 0,
    totalCooperatives: 0,
    activeExtensionOfficers: 0,
  };
  setCache(cacheKey, emptyResult);
  return emptyResult;
}

// ============================================================================
// 2. FARMERS
// ============================================================================
const FARMER_SELECT_FIELDS =
  'id, profile_id, farmer_id_code, id_number, full_name, gender, date_of_birth, phone_number, phone, email, county, district, community, status, cooperative_id, photo_url, created_at, updated_at, cooperative:cooperatives(id, name, code, county)';

export async function getFarmers(limit?: number): Promise<Farmer[]> {
  const cacheKey = `farmers_${limit || 'all'}`;
  const cached = getCached<Farmer[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    let query = supabase
      .from('farmers')
      .select(FARMER_SELECT_FIELDS)
      .order('created_at', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && Array.isArray(data)) {
      setCache(cacheKey, data as Farmer[]);
      return data as Farmer[];
    }
    if (error) {
      console.warn('Supabase getFarmers error:', error.message);
    }
  } catch (e) {
    console.warn('Failed to query farmers from Supabase:', e);
  }

  return [];
}

export async function getFarmerById(id: string): Promise<Farmer | null> {
  const cacheKey = `farmer_${id}`;
  const cached = getCached<Farmer>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const query = supabase
      .from('farmers')
      .select(FARMER_SELECT_FIELDS)
      .eq('id', id)
      .maybeSingle();

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && data) {
      setCache(cacheKey, data as Farmer);
      return data as Farmer;
    }
  } catch (e) {
    console.warn('Failed to query farmer by id from Supabase:', e);
  }

  return null;
}

export async function updateFarmerStatus(id: string, status: 'active' | 'disabled'): Promise<boolean> {
  clearApiCache();
  try {
    const supabase = createClient();
    const { error } = (await withTimeout(
      supabase
        .from('farmers')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id),
      6000
    )) as any;

    if (!error) {
      return true;
    }
    console.warn('Error updating farmer status in Supabase:', error.message);
  } catch (e) {
    console.warn('Failed to update farmer status in Supabase:', e);
  }

  return false;
}

// ============================================================================
// 3. FARMS
// ============================================================================
const FARM_SELECT_FIELDS =
  'id, farmer_id, name, county, district, community, size, size_unit, latitude, longitude, gps_lat, gps_lng, ownership_type, irrigation, soil_type, photo_url, description, is_active, created_at, updated_at, farmer:farmers(id, full_name, farmer_id_code, phone_number)';

export async function getFarms(limit?: number): Promise<Farm[]> {
  const cacheKey = `farms_${limit || 'all'}`;
  const cached = getCached<Farm[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    let query = supabase
      .from('farms')
      .select(FARM_SELECT_FIELDS)
      .order('created_at', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && Array.isArray(data)) {
      setCache(cacheKey, data as Farm[]);
      return data as Farm[];
    }
  } catch (e) {
    console.warn('Failed to query farms from Supabase:', e);
  }

  return [];
}

export async function getFarmsByFarmerId(farmerId: string): Promise<Farm[]> {
  const cacheKey = `farms_farmer_${farmerId}`;
  const cached = getCached<Farm[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const query = supabase
      .from('farms')
      .select(FARM_SELECT_FIELDS)
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false });

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && Array.isArray(data)) {
      setCache(cacheKey, data as Farm[]);
      return data as Farm[];
    }
  } catch (e) {
    console.warn('Failed to query farms by farmerId from Supabase:', e);
  }

  return [];
}

export async function getFarmById(id: string): Promise<Farm | null> {
  const cacheKey = `farm_${id}`;
  const cached = getCached<Farm>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const query = supabase
      .from('farms')
      .select(FARM_SELECT_FIELDS)
      .eq('id', id)
      .maybeSingle();

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && data) {
      setCache(cacheKey, data as Farm);
      return data as Farm;
    }
  } catch (e) {
    console.warn('Failed to query farm by id from Supabase:', e);
  }

  return null;
}

// ============================================================================
// 4. CROPS & SEASONS
// ============================================================================
const CROP_SELECT_FIELDS = 'id, name, code, category, default_unit, description, variety, is_active';

export async function getCrops(): Promise<Crop[]> {
  const cacheKey = 'crops_all';
  const cached = getCached<Crop[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const query = supabase.from('crops').select(CROP_SELECT_FIELDS).order('name');
    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && Array.isArray(data)) {
      setCache(cacheKey, data as Crop[]);
      return data as Crop[];
    }
  } catch (e) {
    console.warn('Failed to query crops from Supabase:', e);
  }

  return [];
}

const SEASON_SELECT_FIELDS =
  'id, farm_id, crop_id, crop_variety_id, season_name, planting_date, expected_harvest_date, cultivated_area, seed_quantity, status, created_at, updated_at, farm:farms(id, name, county), crop:crops(id, name)';

export async function getSeasons(limit?: number): Promise<FarmSeason[]> {
  const cacheKey = `seasons_${limit || 'all'}`;
  const cached = getCached<FarmSeason[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    let query = supabase
      .from('farm_seasons')
      .select(SEASON_SELECT_FIELDS)
      .order('created_at', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && Array.isArray(data)) {
      setCache(cacheKey, data as FarmSeason[]);
      return data as FarmSeason[];
    }
  } catch (e) {
    console.warn('Failed to query seasons from Supabase:', e);
  }

  return [];
}

// ============================================================================
// 5. FARM ACTIVITIES
// ============================================================================
const ACTIVITY_SELECT_FIELDS =
  'id, farmer_id, farm_id, season_id, activity_type, activity_date, description, quantity, unit, cost, labor_count, photo_url, recorded_by, sync_status, created_at, updated_at, farmer:farmers(id, full_name, farmer_id_code), farm:farms(id, name)';

export async function getFarmActivities(limit?: number): Promise<FarmActivity[]> {
  const cacheKey = `activities_${limit || 'all'}`;
  const cached = getCached<FarmActivity[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    let query = supabase
      .from('farm_activities')
      .select(ACTIVITY_SELECT_FIELDS)
      .order('activity_date', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && Array.isArray(data)) {
      setCache(cacheKey, data as FarmActivity[]);
      return data as FarmActivity[];
    }
  } catch (e) {
    console.warn('Failed to query farm activities from Supabase:', e);
  }

  return [];
}

export async function getFarmActivitiesByFarmerId(farmerId: string): Promise<FarmActivity[]> {
  const cacheKey = `activities_farmer_${farmerId}`;
  const cached = getCached<FarmActivity[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const query = supabase
      .from('farm_activities')
      .select(ACTIVITY_SELECT_FIELDS)
      .eq('farmer_id', farmerId)
      .order('activity_date', { ascending: false });

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && Array.isArray(data)) {
      setCache(cacheKey, data as FarmActivity[]);
      return data as FarmActivity[];
    }
  } catch (e) {
    console.warn('Failed to query activities by farmerId from Supabase:', e);
  }

  return [];
}

export async function getFarmActivitiesByFarmId(farmId: string): Promise<FarmActivity[]> {
  const cacheKey = `activities_farm_${farmId}`;
  const cached = getCached<FarmActivity[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const query = supabase
      .from('farm_activities')
      .select(ACTIVITY_SELECT_FIELDS)
      .eq('farm_id', farmId)
      .order('activity_date', { ascending: false });

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && Array.isArray(data)) {
      setCache(cacheKey, data as FarmActivity[]);
      return data as FarmActivity[];
    }
  } catch (e) {
    console.warn('Failed to query activities by farmId from Supabase:', e);
  }

  return [];
}

// ============================================================================
// 6. HARVEST BATCHES
// ============================================================================
const HARVEST_SELECT_FIELDS =
  'id, batch_reference, batch_code, farmer_id, farm_id, season_id, crop_id, crop_variety_id, harvest_date, quantity, quantity_kg, unit, storage_location, photo_url, observations, status, quality_status, qr_token, created_at, updated_at, farmer:farmers(id, full_name, farmer_id_code), farm:farms(id, name, county), crop:crops(id, name)';

export async function getHarvestBatches(limit?: number): Promise<HarvestBatch[]> {
  const cacheKey = `harvest_batches_${limit || 'all'}`;
  const cached = getCached<HarvestBatch[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    let query = supabase
      .from('harvest_batches')
      .select(HARVEST_SELECT_FIELDS)
      .order('created_at', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && Array.isArray(data)) {
      setCache(cacheKey, data as HarvestBatch[]);
      return data as HarvestBatch[];
    }
  } catch (e) {
    console.warn('Failed to query harvest batches from Supabase:', e);
  }

  return [];
}

export async function getHarvestBatchesByFarmerId(farmerId: string): Promise<HarvestBatch[]> {
  const cacheKey = `harvests_farmer_${farmerId}`;
  const cached = getCached<HarvestBatch[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const query = supabase
      .from('harvest_batches')
      .select(HARVEST_SELECT_FIELDS)
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false });

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && Array.isArray(data)) {
      setCache(cacheKey, data as HarvestBatch[]);
      return data as HarvestBatch[];
    }
  } catch (e) {
    console.warn('Failed to query harvests by farmerId from Supabase:', e);
  }

  return [];
}

export async function getHarvestBatchesByFarmId(farmId: string): Promise<HarvestBatch[]> {
  const cacheKey = `harvests_farm_${farmId}`;
  const cached = getCached<HarvestBatch[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const query = supabase
      .from('harvest_batches')
      .select(HARVEST_SELECT_FIELDS)
      .eq('farm_id', farmId)
      .order('created_at', { ascending: false });

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && Array.isArray(data)) {
      setCache(cacheKey, data as HarvestBatch[]);
      return data as HarvestBatch[];
    }
  } catch (e) {
    console.warn('Failed to query harvests by farmId from Supabase:', e);
  }

  return [];
}

export async function getHarvestById(id: string): Promise<HarvestBatch | null> {
  const cacheKey = `harvest_${id}`;
  const cached = getCached<HarvestBatch>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const query = supabase
      .from('harvest_batches')
      .select(HARVEST_SELECT_FIELDS)
      .or(`id.eq.${id},batch_reference.eq.${id}`)
      .maybeSingle();

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && data) {
      setCache(cacheKey, data as HarvestBatch);
      return data as HarvestBatch;
    }
  } catch (e) {
    console.warn('Failed to query harvest by id from Supabase:', e);
  }

  return null;
}

// ============================================================================
// 7. QUALITY INSPECTIONS
// ============================================================================
const INSPECTION_SELECT_FIELDS =
  'id, batch_id, inspector_id, inspection_date, moisture_content, foreign_matter_pct, broken_grains_pct, final_grade, decision_status, notes, created_at, batch:harvest_batches(id, batch_reference, quantity, unit, farmer:farmers(id, full_name), crop:crops(id, name))';

export async function getQualityInspections(limit?: number): Promise<QualityInspection[]> {
  const cacheKey = `inspections_${limit || 'all'}`;
  const cached = getCached<QualityInspection[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    let query = supabase
      .from('quality_inspections')
      .select(INSPECTION_SELECT_FIELDS)
      .order('created_at', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && Array.isArray(data)) {
      setCache(cacheKey, data as QualityInspection[]);
      return data as QualityInspection[];
    }
  } catch (e) {
    console.warn('Failed to query quality inspections from Supabase:', e);
  }

  return [];
}

export async function getQualityInspectionById(id: string): Promise<QualityInspection | null> {
  const cacheKey = `inspection_${id}`;
  const cached = getCached<QualityInspection>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const query = supabase
      .from('quality_inspections')
      .select(INSPECTION_SELECT_FIELDS)
      .or(`id.eq.${id},batch_id.eq.${id}`)
      .maybeSingle();

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && data) {
      setCache(cacheKey, data as QualityInspection);
      return data as QualityInspection;
    }
  } catch (e) {
    console.warn('Failed to query inspection by id from Supabase:', e);
  }

  return null;
}

// ============================================================================
// 8. COOPERATIVES
// ============================================================================
const COOP_SELECT_FIELDS =
  'id, name, code, registration_number, member_count, status, county, district, address, contact_person, contact_phone, contact_email, created_at';

export async function getCooperatives(): Promise<Cooperative[]> {
  const cacheKey = 'cooperatives_all';
  const cached = getCached<Cooperative[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const query = supabase.from('cooperatives').select(COOP_SELECT_FIELDS).order('name');
    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && Array.isArray(data)) {
      setCache(cacheKey, data as Cooperative[]);
      return data as Cooperative[];
    }
  } catch (e) {
    console.warn('Failed to query cooperatives from Supabase:', e);
  }

  return [];
}

export async function getCooperativeById(id: string): Promise<Cooperative | null> {
  const cacheKey = `coop_${id}`;
  const cached = getCached<Cooperative>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const query = supabase
      .from('cooperatives')
      .select(COOP_SELECT_FIELDS)
      .or(`id.eq.${id},code.eq.${id}`)
      .maybeSingle();

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && data) {
      setCache(cacheKey, data as Cooperative);
      return data as Cooperative;
    }
  } catch (e) {
    console.warn('Failed to query cooperative by id from Supabase:', e);
  }

  return null;
}

// ============================================================================
// 9. INPUTS, AUDIT LOGS, PROFILES
// ============================================================================
const INPUT_SELECT_FIELDS =
  'id, farm_id, season_id, name, category, quantity, unit, purchase_date, supplier, cost, currency, notes, created_at, farm:farms(id, name)';

export async function getInputs(limit?: number): Promise<InputRecord[]> {
  const cacheKey = `inputs_${limit || 'all'}`;
  const cached = getCached<InputRecord[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    let query = supabase
      .from('input_records')
      .select(INPUT_SELECT_FIELDS)
      .order('created_at', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && Array.isArray(data)) {
      setCache(cacheKey, data as InputRecord[]);
      return data as InputRecord[];
    }
  } catch (e) {
    console.warn('Failed to query input records from Supabase:', e);
  }

  return [];
}

const AUDIT_SELECT_FIELDS = 'id, user_id, action, entity_type, entity_id, details, ip_address, created_at';

export async function getAuditLogs(limit?: number): Promise<AuditLog[]> {
  const cacheKey = `audit_logs_${limit || 'all'}`;
  const cached = getCached<AuditLog[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    let query = supabase
      .from('audit_logs')
      .select(AUDIT_SELECT_FIELDS)
      .order('created_at', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && Array.isArray(data)) {
      setCache(cacheKey, data as AuditLog[]);
      return data as AuditLog[];
    }
  } catch (e) {
    console.warn('Failed to query audit logs from Supabase:', e);
  }

  return [];
}

const PROFILE_SELECT_FIELDS =
  'id, full_name, phone, email, role, county, district, community, avatar_url, cooperative_id, created_at, updated_at';

export async function getProfiles(): Promise<Profile[]> {
  const cacheKey = 'profiles_all';
  const cached = getCached<Profile[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const query = supabase
      .from('profiles')
      .select(PROFILE_SELECT_FIELDS)
      .order('created_at', { ascending: false });

    const { data, error } = (await withTimeout(query, 8000)) as any;
    if (!error && Array.isArray(data)) {
      setCache(cacheKey, data as Profile[]);
      return data as Profile[];
    }
  } catch (e) {
    console.warn('Failed to query profiles from Supabase:', e);
  }

  return [];
}
