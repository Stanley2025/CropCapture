import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserRole, Farmer, Profile, SyncStatusType, AppNotification } from '../types/database';
import { localDb, generateUUID } from '../services/storage/localDatabase';
import { syncEngine } from '../services/sync/syncEngine';

export interface PersonaDetails {
  title: string;
  badge: string;
  description: string;
  badgeVariant: 'success' | 'info' | 'warning' | 'accent';
  profile: Profile;
  farmer?: Farmer;
}

export const PERSONAS: Record<string, PersonaDetails> = {
  farmer: {
    title: 'Farmer Persona',
    badge: 'FARMER',
    badgeVariant: 'success',
    description: 'Manage personal farm parcels, cropping cycles, activities, harvests, and inputs.',
    profile: {
      id: 'p0000000-0000-0000-0000-000000000001',
      full_name: 'Emmanuel Gaye',
      phone: '+231-77-654-3210',
      email: 'farmer@cropcapture.app',
      role: 'farmer',
      county: 'Nimba',
      district: 'Sanniquellie-Mahn',
      community: 'Gbehley',
      cooperative_id: '33333333-3333-3333-3333-333333333301',
      created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    farmer: {
      id: 'f0000000-0000-0000-0000-000000000001',
      profile_id: 'p0000000-0000-0000-0000-000000000001',
      farmer_id_code: 'AGR-F-000001',
      full_name: 'Emmanuel Gaye',
      gender: 'Male',
      date_of_birth: '1984-05-12',
      phone_number: '+231-77-654-3210',
      email: 'farmer@cropcapture.app',
      county: 'Nimba',
      district: 'Sanniquellie-Mahn',
      community: 'Gbehley',
      cooperative_id: '33333333-3333-3333-3333-333333333301',
      created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  extension_officer: {
    title: 'Extension Officer',
    badge: 'EXTENSION',
    badgeVariant: 'info',
    description: 'Conduct field diagnostics, GPS farm visits, advisory recommendations, and follow-ups.',
    profile: {
      id: 'p0000000-0000-0000-0000-000000000002',
      full_name: 'Kebbeh Flomo',
      phone: '+231-88-123-4567',
      email: 'extension@cropcapture.app',
      role: 'extension_officer',
      county: 'Bong & Nimba',
      district: 'Central Agricultural Zone',
      community: 'Suakoko Extension Hub',
      cooperative_id: '33333333-3333-3333-3333-333333333301',
      created_at: new Date(Date.now() - 120 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  quality_inspector: {
    title: 'Quality Inspector',
    badge: 'INSPECTOR',
    badgeVariant: 'warning',
    description: 'Inspect harvested batches, evaluate moisture/defects, and issue certification stamps.',
    profile: {
      id: 'p0000000-0000-0000-0000-000000000003',
      full_name: 'Varney Fahnbulleh',
      phone: '+231-77-888-9999',
      email: 'inspector@cropcapture.app',
      role: 'quality_inspector',
      county: 'Montserrado & Nimba',
      district: 'National Standards & Metrology',
      community: 'National Rice & Cocoa Quality Bureau',
      created_at: new Date(Date.now() - 150 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  cooperative_manager: {
    title: 'Cooperative Manager',
    badge: 'COOPERATIVE',
    badgeVariant: 'accent',
    description: 'Review aggregate member production, audit sync status, and export trade manifests.',
    profile: {
      id: 'p0000000-0000-0000-0000-000000000004',
      full_name: 'Arthur Sherman',
      phone: '+231-77-555-1122',
      email: 'admin@cropcapture.app',
      role: 'cooperative_manager',
      county: 'Nimba',
      district: 'Sanniquellie',
      community: 'Nimba Farmers Multipurpose Union',
      cooperative_id: '33333333-3333-3333-3333-333333333301',
      created_at: new Date(Date.now() - 200 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
};

interface AppState {
  isAuthenticated: boolean;
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
  login: (email: string, password?: string, role?: UserRole) => Promise<boolean>;
  loginAsRole: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => void;
  toggleOfflineMode: () => void;
  triggerManualSync: () => Promise<void>;
  refreshPendingSyncCount: () => Promise<void>;
  markNotificationRead: (id: string) => void;
  updateProfilePhoto: (photoUri: string | null) => Promise<void>;
  registerFarmerAccount: (farmerData: {
    farm_id_code: string;
    full_name?: string;
    date_of_birth?: string;
    gender?: string;
    address?: string;
    pin?: string;
    id_type?: string;
    id_number?: string;
  }) => Promise<Farmer>;
}

const INITIAL_NOTIFICATIONS: AppNotification[] = [];

export const useAppStore = create<AppState>((set, get) => ({
  isAuthenticated: false,
  currentRole: 'farmer',
  isOfflineMode: false,
  syncStatus: 'synced',
  pendingSyncCount: 0,
  lastSyncTime: null,
  currentFarmer: PERSONAS.farmer.farmer!,
  currentUserProfile: PERSONAS.farmer.profile,
  notifications: INITIAL_NOTIFICATIONS,
  isInitialized: false,

  initialize: async () => {
    try {
      await localDb.purgeMockData();
      await localDb.seedDefaultDataIfEmpty();
      const lastSync = await localDb.getLastSyncTimestamp();
      const queue = await localDb.getSyncQueue();
      const pendingCount = queue.filter(
        (i) => i.status === 'waiting_to_sync' || i.status === 'sync_failed'
      ).length;

      // Check stored auth session
      const savedAuth = await AsyncStorage.getItem('@cropcapture_auth_session');
      let isAuth = false;
      let activeRole: UserRole = 'farmer';
      let activeProfile = PERSONAS.farmer.profile;
      let activeFarmer = PERSONAS.farmer.farmer!;

      if (savedAuth) {
        try {
          const parsed = JSON.parse(savedAuth);
          if (parsed && parsed.role) {
            isAuth = true;
            activeRole = parsed.role;
            if (parsed.role === 'farmer' && (parsed.farmId || parsed.email)) {
              const allFarmers = await localDb.getFarmers();
              const matchedFarmer = allFarmers.find(
                (f) =>
                  (parsed.farmId && f.farmer_id_code === parsed.farmId) ||
                  (parsed.email && f.email === parsed.email)
              );
              if (matchedFarmer) {
                activeFarmer = matchedFarmer;
                activeProfile = {
                  id: matchedFarmer.id,
                  full_name: matchedFarmer.full_name,
                  role: 'farmer',
                  county: matchedFarmer.county,
                  district: matchedFarmer.district,
                  community: matchedFarmer.community,
                  created_at: matchedFarmer.created_at,
                };
              }
            } else if (PERSONAS[parsed.role]) {
              activeProfile = PERSONAS[parsed.role].profile;
              if (PERSONAS[parsed.role].farmer) {
                activeFarmer = PERSONAS[parsed.role].farmer!;
              }
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // Check for saved custom profile photo
      const savedPhoto = await AsyncStorage.getItem(`@cropcapture_user_photo_${activeRole}`);
      if (savedPhoto) {
        activeProfile = { ...activeProfile, avatar_url: savedPhoto };
        if (activeFarmer) {
          activeFarmer = { ...activeFarmer, photo_url: savedPhoto };
        }
      }

      // Subscribe to sync engine status
      syncEngine.subscribeStatus((status) => {
        set({ syncStatus: status });
      });

      set({
        isAuthenticated: isAuth,
        currentRole: activeRole,
        currentUserProfile: activeProfile,
        currentFarmer: activeFarmer,
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

  login: async (email: string, _password?: string, role?: UserRole) => {
    let targetRole: string = role || 'farmer';

    if (!role) {
      const cleanEmail = email.toLowerCase().trim();
      if (cleanEmail.includes('extension')) targetRole = 'extension_officer';
      else if (cleanEmail.includes('inspect')) targetRole = 'quality_inspector';
      else if (cleanEmail.includes('admin') || cleanEmail.includes('coop')) targetRole = 'cooperative_manager';
      else targetRole = 'farmer';
    }

    const persona = PERSONAS[targetRole] || PERSONAS.farmer;
    let activeFarmer = persona.farmer || get().currentFarmer;
    let activeProfile = persona.profile;

    if (targetRole === 'farmer') {
      const cleanInput = (email || '').trim().toLowerCase();
      const allFarmers = await localDb.getFarmers();
      const matched = allFarmers.find(
        (f) =>
          f.farmer_id_code?.toLowerCase() === cleanInput ||
          f.email?.toLowerCase() === cleanInput ||
          (cleanInput.length === 6 && f.farmer_id_code === cleanInput)
      );
      if (matched) {
        activeFarmer = matched;
        activeProfile = {
          id: matched.id,
          full_name: matched.full_name,
          role: 'farmer',
          county: matched.county,
          district: matched.district,
          community: matched.community,
          created_at: matched.created_at,
        };
      }
    }

    await AsyncStorage.setItem(
      '@cropcapture_auth_session',
      JSON.stringify({
        role: targetRole,
        email: email || activeProfile.email,
        farmId: activeFarmer?.farmer_id_code,
        loggedInAt: new Date().toISOString(),
      })
    );

    const savedPhoto = await AsyncStorage.getItem(`@cropcapture_user_photo_${targetRole}`);

    set({
      isAuthenticated: true,
      currentRole: targetRole as UserRole,
      currentUserProfile: {
        ...activeProfile,
        email: email ? email.trim() : activeProfile.email,
        avatar_url: savedPhoto || activeProfile.avatar_url,
      },
      currentFarmer: {
        ...activeFarmer,
        photo_url: savedPhoto || activeFarmer?.photo_url || null,
      },
    });

    return true;
  },

  loginAsRole: async (role: UserRole) => {
    const roleKey = role === 'agricultural_admin' || role === 'super_admin' ? 'cooperative_manager' : role;
    const persona = PERSONAS[roleKey] || PERSONAS.farmer;

    await AsyncStorage.setItem(
      '@cropcapture_auth_session',
      JSON.stringify({
        role: persona.profile.role,
        email: persona.profile.email,
        loggedInAt: new Date().toISOString(),
      })
    );

    set({
      isAuthenticated: true,
      currentRole: persona.profile.role,
      currentUserProfile: persona.profile,
      currentFarmer: persona.farmer || get().currentFarmer,
    });
  },

  logout: async () => {
    await AsyncStorage.removeItem('@cropcapture_auth_session');
    set({
      isAuthenticated: false,
      currentRole: 'farmer',
      currentUserProfile: PERSONAS.farmer.profile,
      currentFarmer: PERSONAS.farmer.farmer!,
    });
  },

  registerFarmerAccount: async (farmerData) => {
    const id = generateUUID();
    const newFarmer: Farmer = {
      id,
      profile_id: null,
      farmer_id_code:
        farmerData.farm_id_code || Math.floor(100000 + Math.random() * 900000).toString(),
      full_name: farmerData.full_name?.trim() || `Farmer ${farmerData.farm_id_code}`,
      gender: farmerData.gender || null,
      date_of_birth: farmerData.date_of_birth || null,
      phone_number: '+231-77-000-0000',
      email: `farmer_${farmerData.farm_id_code}@cropcapture.app`,
      county: 'Nimba',
      district: farmerData.address?.trim() || 'Central District',
      community: farmerData.address?.trim() || 'Main Village',
      address: farmerData.address?.trim() || null,
      cooperative_id: '33333333-3333-3333-3333-333333333301',
      pin: farmerData.pin || null,
      id_type: farmerData.id_type || null,
      id_number: farmerData.id_number || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await localDb.saveFarmer(newFarmer, true);

    await AsyncStorage.setItem(
      '@cropcapture_auth_session',
      JSON.stringify({
        role: 'farmer',
        email: newFarmer.email,
        farmId: newFarmer.farmer_id_code,
        loggedInAt: new Date().toISOString(),
      })
    );

    const welcomeNotification: AppNotification = {
      id: generateUUID(),
      user_id: newFarmer.id,
      title: 'Welcome to CropCapture!',
      message: `Your account has been registered with Farm ID: ${newFarmer.farmer_id_code}. Register your farm parcel to begin recording crop and livestock activities.`,
      type: 'system',
      is_read: false,
      created_at: new Date().toISOString(),
    };

    set({
      isAuthenticated: true,
      currentRole: 'farmer',
      notifications: [welcomeNotification],
      currentUserProfile: {
        id: newFarmer.id,
        full_name: newFarmer.full_name,
        role: 'farmer',
        county: newFarmer.county,
        district: newFarmer.district,
        community: newFarmer.community,
        created_at: newFarmer.created_at,
      },
      currentFarmer: newFarmer,
    });

    return newFarmer;
  },

  setRole: (role: UserRole) => {
    const roleKey = role === 'agricultural_admin' || role === 'super_admin' ? 'cooperative_manager' : role;
    const persona = PERSONAS[roleKey] || PERSONAS.farmer;
    set({
      currentRole: role,
      currentUserProfile: persona.profile,
      currentFarmer: persona.farmer || get().currentFarmer,
    });
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

  updateProfilePhoto: async (photoUri: string | null) => {
    try {
      const role = get().currentRole;
      if (photoUri) {
        await AsyncStorage.setItem(`@cropcapture_user_photo_${role}`, photoUri);
      } else {
        await AsyncStorage.removeItem(`@cropcapture_user_photo_${role}`);
      }
      set((state) => ({
        currentUserProfile: {
          ...state.currentUserProfile,
          avatar_url: photoUri,
        },
        currentFarmer: {
          ...state.currentFarmer,
          photo_url: photoUri,
        },
      }));
    } catch (e) {
      console.error('Failed to update profile photo:', e);
    }
  },
}));
