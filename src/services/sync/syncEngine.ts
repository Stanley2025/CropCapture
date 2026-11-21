import { localDb, SyncQueueItem, SeasonRecordKind } from '../storage/localDatabase';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { SyncStatusType } from '../../types/database';
import { findCropById } from '../../shared/farmRecords';
import { upsertDroppingMissingColumns } from '../../shared/columnFallback';

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
  /** Columns the remote database does not have yet, per table (learned from its errors). */
  private skippedColumns = new Map<string, Set<string>>();
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

    // Strict dependency rank ordering: Parents before Children!
    // farmer (1) -> farm (2) -> season (3) -> activity / input / expense (4) -> harvest (5) -> inspection (6)
    const DEPENDENCY_RANK: Record<string, number> = {
      farmer: 1,
      farm: 2,
      season: 3,
      farm_plan: 3,
      activity: 4,
      input: 4,
      expense: 4,
      season_details: 4,
      season_labor: 4,
      season_problem: 4,
      season_disposal: 4,
      season_weather: 4,
      harvest: 5,
      inspection: 6,
      harvest_photo: 6,
    };

    pendingItems.sort((a, b) => {
      const rankA = DEPENDENCY_RANK[a.entity_type] || 99;
      const rankB = DEPENDENCY_RANK[b.entity_type] || 99;
      if (rankA !== rankB) return rankA - rankB;
      return a.created_at.localeCompare(b.created_at);
    });

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    const canSyncOnline = isSupabaseConfigured();

    for (const item of pendingItems) {
      try {
        if (!canSyncOnline) {
          // If Supabase live URL is in offline/demo mode, simulate successful idempotent sync
          await new Promise((res) => setTimeout(res, 50));
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
        const errorMessage = err?.message || 'Network error during sync';
        // The server allows 4 photos per harvest. Another phone got there first: this photo is dropped
        // here (the farmer is not stuck with a sync error that can never succeed).
        if (item.entity_type === 'harvest_photo' && /harvest_photo_limit/.test(errorMessage)) {
          await localDb.deleteHarvestPhoto(item.payload.id, false);
          await localDb.updateSyncQueueItem(item.id, { status: 'synced', synced_at: new Date().toISOString(), last_error: errorMessage });
          successCount++;
          continue;
        }
        failureCount++;
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
    } else if (entityType === 'harvest_photo') {
      // phone-only fields: the file path on this phone and the upload queue's bookkeeping
      delete clean.local_uri;
      delete clean.uploaded;
      delete clean.attempts;
      delete clean.next_attempt_at;
      delete clean.last_error;
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
      farm_plan: 'farm_plans',
      harvest_photo: 'harvest_photos',
      activity: 'farm_activities',
      input: 'input_records',
      expense: 'expenses',
      harvest: 'harvest_batches',
      inspection: 'quality_inspections',
      season_details: 'season_details',
      season_labor: 'season_labor',
      season_problem: 'season_problems',
      season_disposal: 'season_disposals',
      season_weather: 'season_weather',
    };

    const tableName = tableMap[item.entity_type];
    if (!tableName) {
      return { success: false, error: `Unknown entity type: ${item.entity_type}` };
    }

    if (item.action === 'create' || item.action === 'update') {
      const sanitized = this.sanitizePayload(item.entity_type, item.payload);

      // Requirement 1: Server-set updated_at timestamp on every row
      sanitized.updated_at = new Date().toISOString();

      // Requirement 4: Server wins on inspection_status, quality_grade and certified_by
      if (item.entity_type === 'inspection') {
        try {
          const { data: serverRecord } = await supabase
            .from('quality_inspections')
            .select('final_grade, decision_status, certified_by, server_version')
            .eq('id', sanitized.id)
            .maybeSingle();

          if (serverRecord) {
            if (serverRecord.final_grade) sanitized.final_grade = serverRecord.final_grade;
            if (serverRecord.decision_status) sanitized.decision_status = serverRecord.decision_status;
            if (serverRecord.certified_by) sanitized.certified_by = serverRecord.certified_by;
            sanitized.server_version = (serverRecord.server_version || 1) + 1;
          }
        } catch {
          // If query fails, continue with sanitized payload
        }
      }

      // Requirement 4: Append-only revisions on expenses and harvests
      if ((item.entity_type === 'expense' || item.entity_type === 'harvest') && item.action === 'update') {
        if (sanitized.parent_record_id) {
          sanitized.is_latest = true;
          try {
            await supabase
              .from(tableName)
              .update({ is_latest: false, updated_at: new Date().toISOString() })
              .eq('id', sanitized.parent_record_id);
          } catch {
            // Continue if column not present yet
          }
        }
      }

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

      // If the remote database has not had every migration applied yet, leave out the columns it
      // does not have and save the rest (instead of failing the whole record). Columns are only
      // dropped when the database itself says it does not have them.
      const skip = this.skippedColumns.get(tableName) || new Set<string>();
      this.skippedColumns.set(tableName, skip);
      const { error, dropped } = await upsertDroppingMissingColumns(
        (rows) => supabase.from(tableName).upsert(rows, { onConflict: 'id' }),
        [sanitized],
        skip
      );
      for (const col of dropped) {
        console.warn(`Sync: ${tableName}.${col} is not in the remote database yet; saved without it. Apply the pending migrations.`);
      }

      if (error) return { success: false, error: error.message };
    } else if (item.action === 'delete') {
      // Requirement 1: Soft-delete (tombstones) so deletes sync cleanly across devices
      const now = new Date().toISOString();
      let { error } = await supabase
        .from(tableName)
        .update({ deleted_at: now, updated_at: now })
        .eq('id', item.payload.id);

      if (error && error.message.includes('deleted_at')) {
        // Fall back to hard delete if remote schema lacks deleted_at column
        const hardDelete = await supabase.from(tableName).delete().eq('id', item.payload.id);
        error = hardDelete.error;
      }
      if (error) return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Per-farmer pull of records written by other channels (USSD, admin, other devices).
   * Farmer-scoped data is small, so farms/seasons/harvests/expenses are pulled in full
   * (lastSyncTime is advanced by the push step, so a delta here would miss records).
   * Remote rows are merged OVER local rows so client-only fields (nested crop/farm,
   * farming_type, livestock_details...) survive.
   */
  public async pullUserDelta(userId: string): Promise<{
    pulledCount: number;
    tablesUpdated: string[];
  }> {
    if (!isSupabaseConfigured() || !userId) {
      return { pulledCount: 0, tablesUpdated: [] };
    }

    const lastSyncTime = (await localDb.getLastSyncTimestamp()) || '1970-01-01T00:00:00Z';
    let totalPulled = 0;
    const tablesUpdated: string[] = [];
    const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));

    try {
      // Records edited on this phone but not uploaded yet must not be overwritten by the server copy.
      const pending = await localDb.getPendingEntityIds();

      // 1. Farms for this farmer
      const { data: remoteFarms } = await supabase.from('farms').select('*').eq('farmer_id', userId);
      const localFarms = await localDb.getFarms();
      const localFarmMap = byId(localFarms);
      if (remoteFarms && remoteFarms.length > 0) {
        for (const rf of remoteFarms) {
          if (pending.has(rf.id)) continue;
          const local = localFarmMap.get(rf.id);
          await localDb.saveFarm(
            { ...local, ...rf, farming_type: rf.farming_type || local?.farming_type || 'crops' },
            false
          );
        }
        totalPulled += remoteFarms.length;
        tablesUpdated.push('farms');
      }

      const farmIds = Array.from(
        new Set([
          ...(remoteFarms || []).map((f: any) => f.id as string),
          ...localFarms.filter((f) => f.farmer_id === userId).map((f) => f.id),
        ])
      );

      if (farmIds.length > 0) {
        // 2. Seasons on those farms
        const { data: remoteSeasons } = await supabase.from('farm_seasons').select('*').in('farm_id', farmIds);
        if (remoteSeasons && remoteSeasons.length > 0) {
          const localSeasonMap = byId(await localDb.getSeasons());
          for (const rs of remoteSeasons) {
            if (pending.has(rs.id)) continue;
            const local = localSeasonMap.get(rs.id);
            await localDb.saveSeason({ crop: findCropById(rs.crop_id) || undefined, ...local, ...rs }, false);
          }
          totalPulled += remoteSeasons.length;
          tablesUpdated.push('farm_seasons');
        }

        // 2b. The farmer's plans for those farms (a tombstone removes the plan here too)
        const { data: remotePlans } = await supabase.from('farm_plans').select('*').in('farm_id', farmIds);
        if (remotePlans && remotePlans.length > 0) {
          for (const rp of remotePlans) {
            if (pending.has(rp.id)) continue;
            if (rp.deleted_at) await localDb.deleteFarmPlan(rp.id, false);
            else await localDb.saveFarmPlan(rp, false);
          }
          totalPulled += remotePlans.length;
          tablesUpdated.push('farm_plans');
        }

        // 2c. Photos of the harvests (the picture file stays in the private bucket; this is its record)
        const { data: remotePhotos } = await supabase.from('harvest_photos').select('*').in('farm_id', farmIds);
        if (remotePhotos && remotePhotos.length > 0) {
          const localPhotoMap = byId(await localDb.getHarvestPhotos());
          for (const rp of remotePhotos) {
            if (pending.has(rp.id)) continue;
            if (rp.deleted_at) await localDb.deleteHarvestPhoto(rp.id, false);
            else await localDb.saveHarvestPhoto({ ...localPhotoMap.get(rp.id), ...rp, upload_status: 'uploaded' }, false);
          }
          totalPulled += remotePhotos.length;
          tablesUpdated.push('harvest_photos');
        }

        // 3. Expenses on those farms
        const { data: remoteExpenses } = await supabase.from('expenses').select('*').in('farm_id', farmIds);
        if (remoteExpenses && remoteExpenses.length > 0) {
          const localExpenseMap = byId(await localDb.getExpenses());
          for (const re of remoteExpenses) {
            if (pending.has(re.id)) continue;
            await localDb.saveExpense({ ...localExpenseMap.get(re.id), ...re }, false);
          }
          totalPulled += remoteExpenses.length;
          tablesUpdated.push('expenses');
        }

        // 3b. Season record: details, labour, problems, harvest outcomes and the weather SUMMARY
        const seasonIds = Array.from(
          new Set([
            ...(remoteSeasons || []).map((x: any) => x.id as string),
            ...(await localDb.getSeasons(farmIds)).map((x) => x.id),
          ])
        );
        if (seasonIds.length > 0) {
          const kinds: Array<[SeasonRecordKind, string]> = [
            ['details', 'season_details'],
            ['labor', 'season_labor'],
            ['problem', 'season_problems'],
            ['disposal', 'season_disposals'],
            ['weather', 'season_weather'],
          ];
          for (const [kind, table] of kinds) {
            const { data: rows } = await supabase.from(table).select('*').in('season_id', seasonIds);
            if (!rows || rows.length === 0) continue;
            for (const row of rows) {
              if (pending.has(row.id)) continue;
              if (row.deleted_at) await localDb.deleteSeasonRecord(kind, row.id, false);
              else await localDb.saveSeasonRecord(kind, row, false);
            }
            totalPulled += rows.length;
            tablesUpdated.push(table);
          }
        }
      }

      // 4. Harvests for this farmer
      const { data: remoteHarvests } = await supabase
        .from('harvest_batches')
        .select('*')
        .eq('farmer_id', userId);

      if (remoteHarvests && remoteHarvests.length > 0) {
        const localHarvestMap = byId(await localDb.getHarvests());
        const farmMap = byId(await localDb.getFarms());
        for (const remote of remoteHarvests) {
          if (pending.has(remote.id)) continue;
          const local = localHarvestMap.get(remote.id);
          const rh: any = {
            crop: findCropById(remote.crop_id) || undefined,
            farm: farmMap.get(remote.farm_id),
            ...local,
            ...remote,
          };
          if (rh.status === 'approved' || rh.server_signature) {
            rh.is_server_verified = true;
            rh.is_offline_pending = false;
          }
          await localDb.saveHarvest(rh, false);
        }
        totalPulled += remoteHarvests.length;
        tablesUpdated.push('harvest_batches');
      }

      // 5. Pull inspections for user's batches
      const localHarvests = await localDb.getHarvests();
      const batchIds = localHarvests.map((h) => h.id);
      if (batchIds.length > 0) {
        const { data: remoteInspections } = await supabase
          .from('quality_inspections')
          .select('*')
          .in('batch_id', batchIds)
          .gt('updated_at', lastSyncTime);

        if (remoteInspections && remoteInspections.length > 0) {
          for (const ri of remoteInspections) {
            await localDb.saveInspection(ri, false);
          }
          totalPulled += remoteInspections.length;
          tablesUpdated.push('quality_inspections');
        }
      }
    } catch (err) {
      console.warn('Delta pull skipped (offline or network dropped):', err);
    }

    return { pulledCount: totalPulled, tablesUpdated };
  }
}

export const syncEngine = SyncEngine.getInstance();
