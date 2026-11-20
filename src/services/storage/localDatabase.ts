import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  Farm,
  FarmActivity,
  FarmSeason,
  HarvestBatch,
  InputRecord,
  ExpenseRecord,
  QualityInspection,
  SyncStatusType,
  Farmer,
  Profile,
  County,
  District,
} from '../../types/database';
import {
  COUNTIES,
  DISTRICTS,
  getCounties as getStaticCounties,
  getDistrictsByCounty as getStaticDistrictsByCounty,
} from '../../constants/liberiaGeographicData';

export interface SyncQueueItem {
  id: string; // client uuid
  entity_type: 'farm' | 'season' | 'activity' | 'input' | 'expense' | 'harvest' | 'inspection' | 'farmer';
  action: 'create' | 'update' | 'delete';
  payload: any;
  status: SyncStatusType;
  retry_count: number;
  last_error?: string | null;
  created_at: string;
  synced_at?: string | null;
}

const STORAGE_KEYS = {
  FARMS: '@agritrack_farms',
  SEASONS: '@agritrack_seasons',
  ACTIVITIES: '@agritrack_activities',
  INPUTS: '@agritrack_inputs',
  EXPENSES: '@agritrack_expenses',
  HARVESTS: '@agritrack_harvests',
  INSPECTIONS: '@agritrack_inspections',
  FARMERS: '@agritrack_farmers',
  PROFILES: '@agritrack_profiles',
  COUNTIES: '@agritrack_counties',
  DISTRICTS: '@agritrack_districts',
  SYNC_QUEUE: '@agritrack_sync_queue',
  LAST_SYNC: '@agritrack_last_sync_time',
};

// Generates cryptographically safe UUID v4
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Generate batch reference in CropCapture format: CRP-2026-CROP-000001
export function generateBatchReference(cropCode: string, sequenceNum?: number): string {
  const year = new Date().getFullYear();
  const cleanCode = (cropCode || 'GEN').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  const seq = sequenceNum ?? Math.floor(100000 + Math.random() * 900000);
  const formattedSeq = String(seq).padStart(6, '0');
  return `CRP-${year}-${cleanCode}-${formattedSeq}`;
}

export class LocalDatabase {
  private static instance: LocalDatabase;

  private constructor() {}

  public static getInstance(): LocalDatabase {
    if (!LocalDatabase.instance) {
      LocalDatabase.instance = new LocalDatabase();
    }
    return LocalDatabase.instance;
  }

  // --- GENERIC ASYNC STORAGE ACCESSORS WITH JSON SAFE PARSE ---
  private async getItems<T>(key: string): Promise<T[]> {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn(`Error reading from ${key}:`, e);
      return [];
    }
  }

  private async setItems<T>(key: string, items: T[]): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(items));
    } catch (e) {
      console.error(`Error saving to ${key}:`, e);
      throw e;
    }
  }

  // --- SYNC QUEUE MANAGEMENT ---
  public async getSyncQueue(): Promise<SyncQueueItem[]> {
    return this.getItems<SyncQueueItem>(STORAGE_KEYS.SYNC_QUEUE);
  }

  public async addToSyncQueue(
    entity_type: SyncQueueItem['entity_type'],
    action: SyncQueueItem['action'],
    payload: any
  ): Promise<SyncQueueItem> {
    const queue = await this.getSyncQueue();
    const item: SyncQueueItem = {
      id: generateUUID(),
      entity_type,
      action,
      payload,
      status: 'waiting_to_sync',
      retry_count: 0,
      created_at: new Date().toISOString(),
    };
    queue.push(item);
    await this.setItems(STORAGE_KEYS.SYNC_QUEUE, queue);
    return item;
  }

  public async updateSyncQueueItem(
    id: string,
    updates: Partial<SyncQueueItem>
  ): Promise<void> {
    const queue = await this.getSyncQueue();
    const updated = queue.map((item) => (item.id === id ? { ...item, ...updates } : item));
    await this.setItems(STORAGE_KEYS.SYNC_QUEUE, updated);
  }

  public async removeSyncQueueItem(id: string): Promise<void> {
    const queue = await this.getSyncQueue();
    const filtered = queue.filter((item) => item.id !== id);
    await this.setItems(STORAGE_KEYS.SYNC_QUEUE, filtered);
  }

  public async clearCompletedSyncQueue(): Promise<void> {
    const queue = await this.getSyncQueue();
    const remaining = queue.filter((item) => item.status !== 'synced');
    await this.setItems(STORAGE_KEYS.SYNC_QUEUE, remaining);
  }

  // --- LAST SYNC TIMESTAMP ---
  public async getLastSyncTimestamp(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  }

  public async setLastSyncTimestamp(timestamp: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp);
  }

  // --- COUNTIES & DISTRICTS (OFFLINE-FIRST) ---
  public async getCounties(): Promise<County[]> {
    const cached = await this.getItems<County>(STORAGE_KEYS.COUNTIES);
    if (cached && cached.length > 0) {
      return cached;
    }
    // Seed initial standard counties if local cache is empty
    await this.setItems(STORAGE_KEYS.COUNTIES, COUNTIES);
    return COUNTIES;
  }

  public async getDistricts(countyIdentifier?: string): Promise<District[]> {
    let districts = await this.getItems<District>(STORAGE_KEYS.DISTRICTS);
    if (!districts || districts.length === 0) {
      districts = DISTRICTS;
      await this.setItems(STORAGE_KEYS.DISTRICTS, DISTRICTS);
    }
    if (!countyIdentifier) return districts;
    const normalized = countyIdentifier.trim().toLowerCase();
    const county = COUNTIES.find(
      (c) =>
        c.id.toLowerCase() === normalized ||
        c.name.toLowerCase() === normalized ||
        c.code.toLowerCase() === normalized
    );
    if (!county) return [];
    return districts.filter((d) => d.county_id === county.id);
  }

  // --- FARMERS ---
  public async getFarmers(): Promise<Farmer[]> {
    return this.getItems<Farmer>(STORAGE_KEYS.FARMERS);
  }

  public async saveFarmer(farmer: Farmer, queueSync = true): Promise<Farmer> {
    const farmers = await this.getFarmers();
    const index = farmers.findIndex((f) => f.id === farmer.id);
    if (index >= 0) {
      farmers[index] = { ...farmer, updated_at: new Date().toISOString() };
    } else {
      farmers.unshift(farmer);
    }
    await this.setItems(STORAGE_KEYS.FARMERS, farmers);
    if (queueSync) {
      await this.addToSyncQueue('farmer', index >= 0 ? 'update' : 'create', farmer);
    }
    return farmer;
  }

  // --- FARMS ---
  public async getFarms(farmerId?: string): Promise<Farm[]> {
    const farms = await this.getItems<Farm>(STORAGE_KEYS.FARMS);
    if (farmerId) {
      return farms.filter((f) => f.farmer_id === farmerId);
    }
    return farms;
  }

  public async saveFarm(farm: Farm, queueSync = true): Promise<Farm> {
    const farms = await this.getItems<Farm>(STORAGE_KEYS.FARMS);
    const index = farms.findIndex((f) => f.id === farm.id);
    if (index >= 0) {
      farms[index] = { ...farm, updated_at: new Date().toISOString() };
    } else {
      farms.unshift(farm);
    }
    await this.setItems(STORAGE_KEYS.FARMS, farms);
    if (queueSync) {
      await this.addToSyncQueue('farm', index >= 0 ? 'update' : 'create', farm);
    }
    return farm;
  }

  // --- SEASONS ---
  public async getSeasons(farmIds?: string[]): Promise<FarmSeason[]> {
    const seasons = await this.getItems<FarmSeason>(STORAGE_KEYS.SEASONS);
    if (farmIds && farmIds.length > 0) {
      const idSet = new Set(farmIds);
      return seasons.filter((s) => idSet.has(s.farm_id));
    }
    return seasons;
  }

  public async saveSeason(season: FarmSeason, queueSync = true): Promise<FarmSeason> {
    const seasons = await this.getItems<FarmSeason>(STORAGE_KEYS.SEASONS);
    const index = seasons.findIndex((s) => s.id === season.id);
    if (index >= 0) {
      seasons[index] = { ...season, updated_at: new Date().toISOString() };
    } else {
      seasons.unshift(season);
    }
    await this.setItems(STORAGE_KEYS.SEASONS, seasons);
    if (queueSync) {
      await this.addToSyncQueue('season', index >= 0 ? 'update' : 'create', season);
    }
    return season;
  }

  // --- ACTIVITIES ---
  public async getActivities(farmerId?: string, farmIds?: string[]): Promise<FarmActivity[]> {
    const activities = await this.getItems<FarmActivity>(STORAGE_KEYS.ACTIVITIES);
    if (!activities || activities.length === 0) {
      return [];
    }

    if (farmerId || (farmIds && farmIds.length > 0)) {
      const idSet = farmIds && farmIds.length > 0 ? new Set(farmIds) : null;
      return activities.filter((a) => {
        if (farmerId && a.farmer_id === farmerId) return true;
        if (idSet && idSet.has(a.farm_id)) return true;
        return false;
      });
    }

    return activities;
  }

  public async saveActivity(activity: FarmActivity, queueSync = true): Promise<FarmActivity> {
    const activities = await this.getItems<FarmActivity>(STORAGE_KEYS.ACTIVITIES);
    const index = activities.findIndex((a) => a.id === activity.id);
    if (index >= 0) {
      activities[index] = { ...activity, updated_at: new Date().toISOString() };
    } else {
      activities.unshift(activity);
    }
    await this.setItems(STORAGE_KEYS.ACTIVITIES, activities);
    if (queueSync) {
      await this.addToSyncQueue('activity', index >= 0 ? 'update' : 'create', activity);
    }
    return activity;
  }

  // --- INPUTS ---
  public async getInputs(farmIds?: string[]): Promise<InputRecord[]> {
    const inputs = await this.getItems<InputRecord>(STORAGE_KEYS.INPUTS);
    if (farmIds && farmIds.length > 0) {
      const idSet = new Set(farmIds);
      return inputs.filter((i) => idSet.has(i.farm_id));
    }
    return inputs;
  }

  public async saveInput(input: InputRecord, queueSync = true): Promise<InputRecord> {
    const inputs = await this.getItems<InputRecord>(STORAGE_KEYS.INPUTS);
    const index = inputs.findIndex((i) => i.id === input.id);
    if (index >= 0) {
      inputs[index] = input;
    } else {
      inputs.unshift(input);
    }
    await this.setItems(STORAGE_KEYS.INPUTS, inputs);
    if (queueSync) {
      await this.addToSyncQueue('input', index >= 0 ? 'update' : 'create', input);
    }
    return input;
  }

  // --- EXPENSES ---
  public async getExpenses(farmIds?: string[]): Promise<ExpenseRecord[]> {
    const expenses = await this.getItems<ExpenseRecord>(STORAGE_KEYS.EXPENSES);
    if (farmIds && farmIds.length > 0) {
      const idSet = new Set(farmIds);
      return expenses.filter((e) => idSet.has(e.farm_id));
    }
    return expenses;
  }

  public async saveExpense(expense: ExpenseRecord, queueSync = true): Promise<ExpenseRecord> {
    const expenses = await this.getItems<ExpenseRecord>(STORAGE_KEYS.EXPENSES);
    const index = expenses.findIndex((e) => e.id === expense.id);
    if (index >= 0) {
      expenses[index] = expense;
    } else {
      expenses.unshift(expense);
    }
    await this.setItems(STORAGE_KEYS.EXPENSES, expenses);
    if (queueSync) {
      await this.addToSyncQueue('expense', index >= 0 ? 'update' : 'create', expense);
    }
    return expense;
  }

  // --- HARVESTS ---
  public async getHarvests(farmerId?: string, farmIds?: string[]): Promise<HarvestBatch[]> {
    const harvests = await this.getItems<HarvestBatch>(STORAGE_KEYS.HARVESTS);
    if (farmerId || (farmIds && farmIds.length > 0)) {
      const idSet = farmIds && farmIds.length > 0 ? new Set(farmIds) : null;
      return harvests.filter((h) => {
        if (farmerId && h.farmer_id === farmerId) return true;
        if (idSet && idSet.has(h.farm_id)) return true;
        return false;
      });
    }
    return harvests;
  }

  public async saveHarvest(harvest: HarvestBatch, queueSync = true): Promise<HarvestBatch> {
    const harvests = await this.getItems<HarvestBatch>(STORAGE_KEYS.HARVESTS);
    const index = harvests.findIndex((h) => h.id === harvest.id);
    if (index >= 0) {
      harvests[index] = { ...harvest, updated_at: new Date().toISOString() };
    } else {
      harvests.unshift(harvest);
    }
    await this.setItems(STORAGE_KEYS.HARVESTS, harvests);
    if (queueSync) {
      await this.addToSyncQueue('harvest', index >= 0 ? 'update' : 'create', harvest);
    }
    return harvest;
  }

  // --- INSPECTIONS ---
  public async getInspections(): Promise<QualityInspection[]> {
    return this.getItems<QualityInspection>(STORAGE_KEYS.INSPECTIONS);
  }

  public async saveInspection(inspection: QualityInspection, queueSync = true): Promise<QualityInspection> {
    const inspections = await this.getInspections();
    const index = inspections.findIndex((i) => i.id === inspection.id);
    if (index >= 0) {
      inspections[index] = { ...inspection, updated_at: new Date().toISOString() };
    } else {
      inspections.unshift(inspection);
    }
    await this.setItems(STORAGE_KEYS.INSPECTIONS, inspections);
    if (queueSync) {
      await this.addToSyncQueue('inspection', index >= 0 ? 'update' : 'create', inspection);
    }
    return inspection;
  }

  // Purge any residual mock/demo records so device shows strictly real data
  public async purgeMockData(): Promise<void> {
    try {
      const demoFarmerId = 'f0000000-0000-0000-0000-000000000001';
      const demoFarmIds = new Set([
        'a1111111-1111-1111-1111-111111111101',
        'a1111111-1111-1111-1111-111111111102',
      ]);
      const demoSeasonIds = new Set([
        's1111111-1111-1111-1111-111111111101',
        's1111111-1111-1111-1111-111111111102',
      ]);

      // Filter farms
      const farms = await this.getItems<Farm>(STORAGE_KEYS.FARMS);
      const cleanFarms = farms.filter((f) => f.farmer_id !== demoFarmerId && !demoFarmIds.has(f.id));
      if (cleanFarms.length !== farms.length) {
        await this.setItems(STORAGE_KEYS.FARMS, cleanFarms);
      }

      // Filter seasons
      const seasons = await this.getItems<FarmSeason>(STORAGE_KEYS.SEASONS);
      const cleanSeasons = seasons.filter((s) => !demoFarmIds.has(s.farm_id) && !demoSeasonIds.has(s.id));
      if (cleanSeasons.length !== seasons.length) {
        await this.setItems(STORAGE_KEYS.SEASONS, cleanSeasons);
      }

      // Filter activities
      const activities = await this.getItems<FarmActivity>(STORAGE_KEYS.ACTIVITIES);
      const cleanActivities = activities.filter(
        (a) =>
          a.farmer_id !== demoFarmerId &&
          !demoFarmIds.has(a.farm_id) &&
          a.id !== 'act-landprep-001'
      );
      if (cleanActivities.length !== activities.length) {
        await this.setItems(STORAGE_KEYS.ACTIVITIES, cleanActivities);
      }

      // Filter inputs
      const inputs = await this.getItems<InputRecord>(STORAGE_KEYS.INPUTS);
      const cleanInputs = inputs.filter((i) => !demoFarmIds.has(i.farm_id));
      if (cleanInputs.length !== inputs.length) {
        await this.setItems(STORAGE_KEYS.INPUTS, cleanInputs);
      }

      // Filter expenses
      const expenses = await this.getItems<ExpenseRecord>(STORAGE_KEYS.EXPENSES);
      const cleanExpenses = expenses.filter((e) => !demoFarmIds.has(e.farm_id));
      if (cleanExpenses.length !== expenses.length) {
        await this.setItems(STORAGE_KEYS.EXPENSES, cleanExpenses);
      }

      // Filter harvests
      const harvests = await this.getItems<HarvestBatch>(STORAGE_KEYS.HARVESTS);
      const cleanHarvests = harvests.filter(
        (h) =>
          h.farmer_id !== demoFarmerId &&
          !demoFarmIds.has(h.farm_id) &&
          h.id !== 'h1111111-1111-1111-1111-111111111101' &&
          h.batch_reference !== 'AGR-2026-RICE-000001'
      );
      if (cleanHarvests.length !== harvests.length) {
        await this.setItems(STORAGE_KEYS.HARVESTS, cleanHarvests);
      }

      // Filter sync queue of stale demo payloads
      const queue = await this.getSyncQueue();
      const cleanQueue = queue.filter((item) => {
        const p = item.payload;
        if (!p) return true;
        if (p.farmer_id === demoFarmerId) return false;
        if (demoFarmIds.has(p.id) || demoFarmIds.has(p.farm_id)) return false;
        if (demoSeasonIds.has(p.id) || demoSeasonIds.has(p.season_id)) return false;
        return true;
      });
      if (cleanQueue.length !== queue.length) {
        await this.setItems(STORAGE_KEYS.SYNC_QUEUE, cleanQueue);
      }
    } catch (e) {
      console.warn('Error purging mock data:', e);
    }
  }

  // No mock data insertion - keeps storage clean for real data
  public async seedDefaultDataIfEmpty(): Promise<void> {
    const lastSync = await this.getLastSyncTimestamp();
    if (!lastSync) {
      await this.setLastSyncTimestamp(new Date().toISOString());
    }
  }
}

export const localDb = LocalDatabase.getInstance();
