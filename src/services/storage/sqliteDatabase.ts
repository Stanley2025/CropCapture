import * as SQLite from 'expo-sqlite';
import { secureKeyManager } from './secureKeyManager';

export interface SqliteSyncOutboxItem {
  id: string;
  entity_type: string;
  action: 'create' | 'update' | 'delete';
  record_id: string;
  payload: string; // JSON string
  dependency_rank: number;
  status: 'waiting_to_sync' | 'synchronizing' | 'synced' | 'sync_failed';
  retry_count: number;
  last_error: string | null;
  created_at: string;
  synced_at: string | null;
}

export const DEPENDENCY_RANK: Record<string, number> = {
  farmer: 1,
  farm: 2,
  season: 3,
  activity: 4,
  input: 4,
  expense: 4,
  harvest: 5,
  inspection: 6,
};

export class SqliteDatabaseService {
  private static instance: SqliteDatabaseService;
  private dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): SqliteDatabaseService {
    if (!SqliteDatabaseService.instance) {
      SqliteDatabaseService.instance = new SqliteDatabaseService();
    }
    return SqliteDatabaseService.instance;
  }

  public async getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        const db = await SQLite.openDatabaseAsync('cropcapture.db');
        const key = await secureKeyManager.getOrCreateDatabaseEncryptionKey();
        try {
          await db.execAsync(`PRAGMA key = '${key}';`);
        } catch {
          // In standard sqlite without sqlcipher pragma key is ignored
        }
        await db.execAsync(`
          PRAGMA journal_mode = WAL;
          PRAGMA foreign_keys = ON;
        `);
        return db;
      })();
    }
    return this.dbPromise;
  }

  public async initializeTables(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const db = await this.getDatabase();
      await db.execAsync(`
        -- 1. Farmers
        CREATE TABLE IF NOT EXISTS farmers (
          id TEXT PRIMARY KEY,
          profile_id TEXT,
          farmer_id_code TEXT,
          full_name TEXT NOT NULL,
          gender TEXT,
          date_of_birth TEXT,
          phone_number TEXT,
          email TEXT,
          county TEXT,
          district TEXT,
          community TEXT,
          cooperative_id TEXT,
          status TEXT DEFAULT 'active',
          server_version INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );

        -- 2. Farms
        CREATE TABLE IF NOT EXISTS farms (
          id TEXT PRIMARY KEY,
          farmer_id TEXT NOT NULL,
          farm_name TEXT NOT NULL,
          county TEXT NOT NULL,
          district TEXT NOT NULL,
          community TEXT,
          total_area REAL,
          boundary_geojson TEXT,
          latitude REAL,
          longitude REAL,
          server_version INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE
        );

        -- 3. Seasons
        CREATE TABLE IF NOT EXISTS farm_seasons (
          id TEXT PRIMARY KEY,
          farm_id TEXT NOT NULL,
          season_name TEXT NOT NULL,
          crop_type TEXT,
          crop_variety TEXT,
          status TEXT DEFAULT 'active',
          start_date TEXT,
          end_date TEXT,
          server_version INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
        );

        -- 4. Activities
        CREATE TABLE IF NOT EXISTS farm_activities (
          id TEXT PRIMARY KEY,
          farm_id TEXT NOT NULL,
          season_id TEXT,
          farmer_id TEXT NOT NULL,
          activity_type TEXT NOT NULL,
          activity_date TEXT NOT NULL,
          notes TEXT,
          cost_usd REAL DEFAULT 0,
          status TEXT DEFAULT 'completed',
          server_version INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );

        -- 5. Expenses (Append-Only Revisions Engine)
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          farm_id TEXT NOT NULL,
          season_id TEXT,
          category TEXT NOT NULL,
          amount REAL NOT NULL,
          currency TEXT DEFAULT 'USD',
          expense_date TEXT NOT NULL,
          description TEXT,
          revision_number INTEGER DEFAULT 1,
          parent_record_id TEXT,
          is_latest INTEGER DEFAULT 1,
          server_version INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );

        -- 6. Harvests (Append-Only Revisions Engine & Verification Flags)
        CREATE TABLE IF NOT EXISTS harvest_batches (
          id TEXT PRIMARY KEY,
          farm_id TEXT NOT NULL,
          season_id TEXT,
          farmer_id TEXT NOT NULL,
          batch_reference TEXT NOT NULL,
          crop_id TEXT,
          crop_variety_id TEXT,
          quantity REAL NOT NULL,
          unit TEXT NOT NULL,
          total_value REAL,
          unit_price REAL,
          harvest_date TEXT NOT NULL,
          status TEXT DEFAULT 'submitted',
          qr_token TEXT NOT NULL,
          is_offline_pending INTEGER DEFAULT 0,
          is_server_verified INTEGER DEFAULT 0,
          server_signature TEXT,
          revision_number INTEGER DEFAULT 1,
          parent_record_id TEXT,
          is_latest INTEGER DEFAULT 1,
          server_version INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );

        -- 7. Inspections
        CREATE TABLE IF NOT EXISTS quality_inspections (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL,
          inspector_id TEXT NOT NULL,
          template_id TEXT,
          inspection_date TEXT NOT NULL,
          final_grade TEXT,
          decision_status TEXT DEFAULT 'pending',
          certified_by TEXT,
          observations TEXT,
          server_version INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          FOREIGN KEY (batch_id) REFERENCES harvest_batches(id) ON DELETE CASCADE
        );

        -- 8. Sync Outbox (Ordered by dependency rank: Parents before Children)
        CREATE TABLE IF NOT EXISTS sync_outbox (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          action TEXT NOT NULL,
          record_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          dependency_rank INTEGER NOT NULL,
          status TEXT DEFAULT 'waiting_to_sync',
          retry_count INTEGER DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL,
          synced_at TEXT
        );

        -- 9. Sync Metadata (Stores high watermark server timestamp / version per table)
        CREATE TABLE IF NOT EXISTS sync_metadata (
          table_name TEXT PRIMARY KEY,
          last_synced_version INTEGER DEFAULT 0,
          last_synced_at TEXT
        );

        -- 10. Deletion Tombstones
        CREATE TABLE IF NOT EXISTS tombstones (
          id TEXT PRIMARY KEY,
          table_name TEXT NOT NULL,
          record_id TEXT NOT NULL,
          deleted_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );

        -- Indices for fast sync delta lookup
        CREATE INDEX IF NOT EXISTS idx_outbox_status_rank ON sync_outbox(status, dependency_rank, created_at);
        CREATE INDEX IF NOT EXISTS idx_harvest_latest ON harvest_batches(is_latest, deleted_at);
        CREATE INDEX IF NOT EXISTS idx_expense_latest ON expenses(is_latest, deleted_at);
      `);

      this.isInitialized = true;
    } catch (e) {
      console.warn('SQLite table initialization warning (may be running in non-native driver):', e);
    }
  }

  /**
   * Enqueue a local change into the sync outbox with strict dependency ranking
   */
  public async queueChange(
    entityType: string,
    action: 'create' | 'update' | 'delete',
    recordId: string,
    payload: Record<string, any>
  ): Promise<void> {
    await this.initializeTables();
    const rank = DEPENDENCY_RANK[entityType] || 99;
    const id = 'outbox_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const createdAt = new Date().toISOString();

    try {
      const db = await this.getDatabase();
      await db.runAsync(
        `INSERT INTO sync_outbox (id, entity_type, action, record_id, payload, dependency_rank, status, retry_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'waiting_to_sync', 0, ?)`,
        [id, entityType, action, recordId, JSON.stringify(payload), rank, createdAt]
      );
    } catch (e) {
      console.warn('Error enqueuing change to sync_outbox:', e);
    }
  }

  /**
   * Returns pending items ordered strictly by dependency rank (parents before children),
   * then by created_at timestamp.
   */
  public async getPendingSyncItems(): Promise<SqliteSyncOutboxItem[]> {
    await this.initializeTables();
    try {
      const db = await this.getDatabase();
      const rows = await db.getAllAsync<SqliteSyncOutboxItem>(
        `SELECT * FROM sync_outbox
         WHERE status IN ('waiting_to_sync', 'sync_failed')
         ORDER BY dependency_rank ASC, created_at ASC`
      );
      return rows;
    } catch (e) {
      console.warn('Error querying pending sync outbox:', e);
      return [];
    }
  }

  /**
   * Record a tombstone when a user soft-deletes a record
   */
  public async recordTombstone(tableName: string, recordId: string): Promise<void> {
    await this.initializeTables();
    const id = 'tombstone_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const deletedAt = new Date().toISOString();
    try {
      const db = await this.getDatabase();
      await db.runAsync(
        `INSERT INTO tombstones (id, table_name, record_id, deleted_at, synced)
         VALUES (?, ?, ?, ?, 0)`,
        [id, tableName, recordId, deletedAt]
      );
    } catch (e) {
      console.warn('Error recording tombstone:', e);
    }
  }
}

export const sqliteDb = SqliteDatabaseService.getInstance();
