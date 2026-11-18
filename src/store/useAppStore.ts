import { create } from 'zustand';
import { UserRole, Farmer, Profile, SyncStatusType, AppNotification } from '../types/database';
import { localDb } from '../services/storage/localDatabase';
import { syncEngine } from '../services/sync/syncEngine';

interface AppState {
  currentRole: UserRole;
  isOfflineMode: boolean;
  syncStatus: SyncStatusType;
  pendingSyncCount: number;
  lastSyncTime: string | null;
  currentFarmer: Farmer;
  currentUserProfile: Profile;
  notifications: AppNotification[];
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  setRole: (role: UserRole) => void;
  toggleOfflineMode: () => void;
  triggerManualSync: () => Promise<void>;
  refreshPendingSyncCount: () => Promise<void>;
  markNotificationRead: (id: string) => void;
}

const DEMO_FARMER: Farmer = {
  id: 'f0000000-0000-0000-0000-000000000001',
  profile_id: 'p0000000-0000-0000-0000-000000000001',
  farmer_id_code: 'AGR-F-000001',
  full_name: 'Emmanuel Gaye',
  gender: 'Male',
  date_of_birth: '1984-05-12',
  phone_number: '+231-77-654-3210',
  email: 'emmanuel.gaye@agritrack.lr',
  county: 'Nimba',
  district: 'Sanniquellie-Mahn',
  community: 'Gbehley',
  cooperative_id: '33333333-3333-3333-3333-333333333301',
  created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  updated_at: new Date().toISOString(),
};

const DEMO_PROFILE: Profile = {
  id: 'p0000000-0000-0000-0000-000000000001',
  full_name: 'Emmanuel Gaye',
  phone: '+231-77-654-3210',
  email: 'emmanuel.gaye@agritrack.lr',
  role: 'farmer',
  county: 'Nimba',
  district: 'Sanniquellie-Mahn',
  community: 'Gbehley',
  cooperative_id: '33333333-3333-3333-3333-333333333301',
  created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  updated_at: new Date().toISOString(),
};

const DEMO_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    user_id: DEMO_PROFILE.id,
    title: 'Harvest Batch Approved',
    message: 'Batch AGR-2026-RICE-000001 has been inspected and received Grade A verification.',
    type: 'inspection',
    is_read: false,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'n2',
    user_id: DEMO_PROFILE.id,
    title: 'Extension Visit Scheduled',
    message: 'Extension Officer Kebbeh Flomo has scheduled a field visit for Gbehley Swamp Farm.',
    type: 'visit',
    is_read: false,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'n3',
    user_id: DEMO_PROFILE.id,
    title: 'Weather & Planting Alert',
    message: 'Favorable rainfall forecast across Nimba County. Recommended time for weeding & fertilizer application.',
    type: 'system',
    is_read: true,
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
];

export const useAppStore = create<AppState>((set, get) => ({
  currentRole: 'farmer',
  isOfflineMode: false,
  syncStatus: 'synced',
  pendingSyncCount: 0,
  lastSyncTime: null,
  currentFarmer: DEMO_FARMER,
  currentUserProfile: DEMO_PROFILE,
  notifications: DEMO_NOTIFICATIONS,
  isInitialized: false,

  initialize: async () => {
    try {
      await localDb.seedDefaultDataIfEmpty();
      const lastSync = await localDb.getLastSyncTimestamp();
      const queue = await localDb.getSyncQueue();
      const pendingCount = queue.filter(
        (i) => i.status === 'waiting_to_sync' || i.status === 'sync_failed'
      ).length;

      // Subscribe to sync engine status
      syncEngine.subscribeStatus((status) => {
        set({ syncStatus: status });
      });

      set({
        isInitialized: true,
        lastSyncTime: lastSync,
        pendingSyncCount: pendingCount,
        syncStatus: pendingCount > 0 ? 'waiting_to_sync' : 'synced',
      });
    } catch (e) {
      console.error('Failed to initialize app store:', e);
      set({ isInitialized: true });
    }
  },

  setRole: (role: UserRole) => {
    const profile = { ...get().currentUserProfile, role };
    set({ currentRole: role, currentUserProfile: profile });
  },

  toggleOfflineMode: () => {
    const newMode = !get().isOfflineMode;
    set({
      isOfflineMode: newMode,
      syncStatus: newMode ? 'saved_on_device' : get().pendingSyncCount > 0 ? 'waiting_to_sync' : 'synced',
    });
  },

  triggerManualSync: async () => {
    if (get().isOfflineMode) {
      set({ syncStatus: 'saved_on_device' });
      return;
    }
    set({ syncStatus: 'synchronizing' });
    const result = await syncEngine.syncQueue();
    const queue = await localDb.getSyncQueue();
    const pendingCount = queue.filter(
      (i) => i.status === 'waiting_to_sync' || i.status === 'sync_failed'
    ).length;

    set({
      lastSyncTime: result.timestamp,
      pendingSyncCount: pendingCount,
      syncStatus: result.failureCount > 0 ? 'sync_failed' : 'synced',
    });
  },

  refreshPendingSyncCount: async () => {
    const queue = await localDb.getSyncQueue();
    const count = queue.filter(
      (i) => i.status === 'waiting_to_sync' || i.status === 'sync_failed'
    ).length;
    set({
      pendingSyncCount: count,
      syncStatus: get().isOfflineMode
        ? 'saved_on_device'
        : count > 0
        ? 'waiting_to_sync'
        : 'synced',
    });
  },

  markNotificationRead: (id: string) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      ),
    }));
  },
}));
