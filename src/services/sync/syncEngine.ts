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

  private async syncItemToSupabase(
    item: SyncQueueItem
  ): Promise<{ success: boolean; error?: string }> {
    const tableMap: Record<string, string> = {
      farm: 'farms',
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
      const { error } = await supabase.from(tableName).upsert(item.payload, {
        onConflict: 'id',
      });
      if (error) return { success: false, error: error.message };
    } else if (item.action === 'delete') {
      const { error } = await supabase.from(tableName).delete().eq('id', item.payload.id);
      if (error) return { success: false, error: error.message };
    }

    return { success: true };
  }
}

export const syncEngine = SyncEngine.getInstance();
