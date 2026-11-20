import { localDb, SyncQueueItem } from '../storage/localDatabase';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { SyncStatusType } from '../../types/database';

export interface SyncResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ id: string; error: string }>;
  timestamp: string;
}

export class SyncEngine {
  private static instance: SyncEngine;
  private isSyncing = false;
  private listeners: Array<(status: SyncStatusType) => void> = [];

  private constructor() {}

  public static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  public subscribeStatus(listener: (status: SyncStatusType) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyStatus(status: SyncStatusType) {
    this.listeners.forEach((l) => l(status));
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  public async syncQueue(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
        errors: [{ id: 'busy', error: 'Sync is already running' }],
        timestamp: new Date().toISOString(),
      };
    }

    this.isSyncing = true;
    this.notifyStatus('synchronizing');

    const queue = await localDb.getSyncQueue();
    const pendingItems = queue.filter(
      (item) => item.status === 'waiting_to_sync' || item.status === 'sync_failed'
    );

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    const canSyncOnline = isSupabaseConfigured();

    for (const item of pendingItems) {
      try {
        if (!canSyncOnline) {
          // If Supabase live URL is in offline/demo mode, simulate successful idempotent sync
          await new Promise((res) => setTimeout(res, 200));
          await localDb.updateSyncQueueItem(item.id, {
            status: 'synced',
            synced_at: new Date().toISOString(),
          });
          successCount++;
        } else {
          // Process online sync against live Supabase tables
          const result = await this.syncItemToSupabase(item);
          if (result.success) {
            await localDb.updateSyncQueueItem(item.id, {
              status: 'synced',
              synced_at: new Date().toISOString(),
            });
            successCount++;
          } else {
            throw new Error(result.error || 'Sync failed');
          }
        }
      } catch (err: any) {
        failureCount++;
        const errorMessage = err?.message || 'Network error during sync';
        errors.push({ id: item.id, error: errorMessage });
        await localDb.updateSyncQueueItem(item.id, {
          status: 'sync_failed',
          retry_count: item.retry_count + 1,
          last_error: errorMessage,
        });
      }
    }

    const timestamp = new Date().toISOString();
    await localDb.setLastSyncTimestamp(timestamp);
    await localDb.clearCompletedSyncQueue();

    this.isSyncing = false;
    this.notifyStatus(failureCount > 0 ? 'sync_failed' : 'synced');

    return {
      totalProcessed: pendingItems.length,
      successCount,
      failureCount,
      errors,
      timestamp,
    };
  }

  private sanitizePayload(entityType: string, rawPayload: any): any {
    if (!rawPayload || typeof rawPayload !== 'object') return rawPayload;
    const clean = { ...rawPayload };

    const isValidUUID = (val: any) =>
      typeof val === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    // Remove client-only metadata across all types
    delete clean.sync_status;

    if (entityType === 'farm') {
      delete clean.farmer;
      if (clean.county_id && !isValidUUID(clean.county_id)) {
        clean.county_id = null;
      }
      if (clean.district_id && !isValidUUID(clean.district_id)) {
        clean.district_id = null;
      }
    } else if (entityType === 'season') {
      delete clean.crop;
      delete clean.variety;
      delete clean.farm;
      if (clean.crop_variety_id && !isValidUUID(clean.crop_variety_id)) {
        clean.crop_variety_id = null;
      }
    } else if (entityType === 'activity') {
      delete clean.farmer;
      delete clean.farm;
      delete clean.season;
      if (clean.recorded_by && !isValidUUID(clean.recorded_by)) {
        clean.recorded_by = null;
      }
    } else if (entityType === 'input') {
      delete clean.farm;
      delete clean.season;
    } else if (entityType === 'expense') {
      delete clean.farm;
      delete clean.season;
    } else if (entityType === 'harvest') {
      delete clean.crop;
      delete clean.farm;
      delete clean.season;
      delete clean.farmer;
      if (clean.crop_variety_id && !isValidUUID(clean.crop_variety_id)) {
        clean.crop_variety_id = null;
      }
    } else if (entityType === 'inspection') {
      delete clean.batch;
      delete clean.results;
      delete clean.evidence;
      if (clean.inspector_id && !isValidUUID(clean.inspector_id)) {
        clean.inspector_id = null;
      }
    } else if (entityType === 'farmer') {
      delete clean.cooperative;
      delete clean.pin;
      delete clean.id_type;
      delete clean.id_number;
      delete clean.address;
      delete clean.photo_url;

      // Ensure date_of_birth is valid ISO date (YYYY-MM-DD) or null for Postgres DATE type
      if (!clean.date_of_birth || typeof clean.date_of_birth !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(clean.date_of_birth.trim())) {
        clean.date_of_birth = null;
      } else {
        clean.date_of_birth = clean.date_of_birth.trim();
      }

      if (clean.profile_id && !isValidUUID(clean.profile_id)) {
        clean.profile_id = null;
      }
      if (clean.cooperative_id && !isValidUUID(clean.cooperative_id)) {
        clean.cooperative_id = null;
      }
      if (!clean.status) {
        clean.status = 'active';
      }
    }

    return clean;
  }

  private async syncItemToSupabase(
    item: SyncQueueItem
  ): Promise<{ success: boolean; error?: string }> {
    const tableMap: Record<string, string> = {
      farm: 'farms',
      farmer: 'farmers',
      season: 'farm_seasons',
      activity: 'farm_activities',
      input: 'input_records',
      expense: 'expenses',
      harvest: 'harvest_batches',
      inspection: 'quality_inspections',
    };

    const tableName = tableMap[item.entity_type];
    if (!tableName) {
      return { success: false, error: `Unknown entity type: ${item.entity_type}` };
    }

    if (item.action === 'create' || item.action === 'update') {
      const sanitized = this.sanitizePayload(item.entity_type, item.payload);

      // Self-heal foreign key if referenced farmer does not exist in Supabase yet
      if (item.entity_type === 'farm' && sanitized.farmer_id) {
        try {
          const { data: farmerExists } = await supabase
            .from('farmers')
            .select('id')
            .eq('id', sanitized.farmer_id)
            .maybeSingle();

          if (!farmerExists) {
            const localFarmers = await localDb.getFarmers();
            const localFarmer = localFarmers.find((f) => f.id === sanitized.farmer_id);
            await supabase.from('farmers').upsert(
              {
                id: sanitized.farmer_id,
                profile_id: null,
                farmer_id_code: localFarmer?.farmer_id_code || '100001',
                full_name: localFarmer?.full_name || 'Farmer',
                phone_number: localFarmer?.phone_number || '+231-77-000-0000',
                email: localFarmer?.email || null,
                county: sanitized.county || localFarmer?.county || 'Nimba',
                district: sanitized.district || localFarmer?.district || 'Central District',
                community: sanitized.community || localFarmer?.community || 'Main Village',
                status: 'active',
              },
              { onConflict: 'id' }
            );
          }
        } catch {
          // Continue with farm upsert
        }
      }

      // Check cooperative foreign key for farmer to prevent constraint failure
      if (item.entity_type === 'farmer' && sanitized.cooperative_id) {
        try {
          const { data: coopExists } = await supabase
            .from('cooperatives')
            .select('id')
            .eq('id', sanitized.cooperative_id)
            .maybeSingle();
          if (!coopExists) {
            sanitized.cooperative_id = null;
          }
        } catch {
          sanitized.cooperative_id = null;
        }
      }

      let { error } = await supabase.from(tableName).upsert(sanitized, {
        onConflict: 'id',
      });

      // Gracefully retry without status if status column does not exist in remote schema yet
      if (error && item.entity_type === 'farmer' && error.message.includes('status')) {
        const withoutStatus = { ...sanitized };
        delete withoutStatus.status;
        const retryResult = await supabase.from(tableName).upsert(withoutStatus, {
          onConflict: 'id',
        });
        error = retryResult.error;
      }

      // Gracefully retry without farming_type if remote Supabase schema has not run migration yet
      if (error && item.entity_type === 'farm' && error.message.includes('farming_type')) {
        const withoutFarmingType = { ...sanitized };
        delete withoutFarmingType.farming_type;
        const retryResult = await supabase.from(tableName).upsert(withoutFarmingType, {
          onConflict: 'id',
        });
        error = retryResult.error;
      }

      if (error) return { success: false, error: error.message };
    } else if (item.action === 'delete') {
      const { error } = await supabase.from(tableName).delete().eq('id', item.payload.id);
      if (error) return { success: false, error: error.message };
    }

    return { success: true };
  }
}

export const syncEngine = SyncEngine.getInstance();
