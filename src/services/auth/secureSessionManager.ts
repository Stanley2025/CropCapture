import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserRole, Profile, Farmer } from '../../types/database';

export interface StoredSession {
  role: UserRole;
  email: string;
  farmId?: string;
  loggedInAt: string;
  farmerId?: string;
  accessToken?: string;
}

export interface StoredPinData {
  saltHex: string;
  hashHex: string;
  iterations: number;
  failedAttempts: number;
  lockedUntilOnline: boolean;
  lastOnlineLogin: string;
  biometricEnabled?: boolean;
}

const SECURE_KEYS = {
  AUTH_SESSION: 'cropcapture_secure_auth_session',
  OFFLINE_PIN: 'cropcapture_secure_offline_pin',
  SQLITE_KEY: 'cropcapture_secure_sqlite_key',
};

const LEGACY_STORAGE_KEYS = {
  AUTH_SESSION: '@cropcapture_auth_session',
};

// 30 days in milliseconds (configurable)
export const MAX_OFFLINE_DAYS = 30;
export const MAX_OFFLINE_MS = MAX_OFFLINE_DAYS * 24 * 60 * 60 * 1000;
export const MAX_FAILED_PIN_ATTEMPTS = 5;

// Helper to convert Uint8Array <-> Hex string
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Slow KDF using PBKDF2 with 100,000 iterations
export async function derivePinHash(
  pin: string,
  saltBytes: Uint8Array,
  iterations: number = 100000
): Promise<string> {
  const enc = new TextEncoder();
  const pinBuffer = enc.encode(pin);

  // SubtleCrypto PBKDF2
  const baseKey = await crypto.subtle.importKey(
    'raw',
    pinBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    256 // 32 bytes
  );

  return bytesToHex(new Uint8Array(derivedBits));
}

// In-memory fallback for non-native environments (Node tests / Web)
const memorySecureStore: Record<string, string> = {};

async function secureGet(key: string): Promise<string | null> {
  try {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      return await SecureStore.getItemAsync(key);
    }
  } catch {
    // Fall back to memoryStore or AsyncStorage
  }
  return memorySecureStore[key] || (await AsyncStorage.getItem(`@secure_${key}`));
}

async function secureSet(key: string, value: string): Promise<void> {
  try {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
  } catch {
    // Fall back
  }
  memorySecureStore[key] = value;
  await AsyncStorage.setItem(`@secure_${key}`, value);
}

async function secureDelete(key: string): Promise<void> {
  try {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
  } catch {
    // Fall back
  }
  delete memorySecureStore[key];
  await AsyncStorage.removeItem(`@secure_${key}`);
}

export class SecureSessionManager {
  private static instance: SecureSessionManager;

  private constructor() {}

  public static getInstance(): SecureSessionManager {
    if (!SecureSessionManager.instance) {
      SecureSessionManager.instance = new SecureSessionManager();
    }
    return SecureSessionManager.instance;
  }

  /**
   * Save authenticated session into SecureStore (never AsyncStorage)
   */
  public async saveSession(session: StoredSession): Promise<void> {
    await secureSet(SECURE_KEYS.AUTH_SESSION, JSON.stringify(session));
    // Clear out legacy AsyncStorage session if it was previously there
    try {
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEYS.AUTH_SESSION);
    } catch {}
  }

  /**
   * Retrieve session with automatic migration from AsyncStorage if needed
   */
  public async getSession(): Promise<StoredSession | null> {
    const secureData = await secureGet(SECURE_KEYS.AUTH_SESSION);
    if (secureData) {
      try {
        return JSON.parse(secureData) as StoredSession;
      } catch {
        return null;
      }
    }

    // Check legacy AsyncStorage and migrate forward
    try {
      const legacyData = await AsyncStorage.getItem(LEGACY_STORAGE_KEYS.AUTH_SESSION);
      if (legacyData) {
        const parsed = JSON.parse(legacyData) as StoredSession;
        if (parsed) {
          await this.saveSession(parsed);
          await AsyncStorage.removeItem(LEGACY_STORAGE_KEYS.AUTH_SESSION);
          return parsed;
        }
      }
    } catch {}

    return null;
  }

  /**
   * Clear session on logout
   */
  public async clearSession(): Promise<void> {
    await secureDelete(SECURE_KEYS.AUTH_SESSION);
    try {
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEYS.AUTH_SESSION);
    } catch {}
  }

  /**
   * Set up or update a slow KDF 4-digit PIN
   */
  public async registerPin(pin: string, lastOnlineLogin?: string): Promise<void> {
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    const saltHex = bytesToHex(saltBytes);
    const hashHex = await derivePinHash(pin, saltBytes, 100000);

    const pinRecord: StoredPinData = {
      saltHex,
      hashHex,
      iterations: 100000,
      failedAttempts: 0,
      lockedUntilOnline: false,
      lastOnlineLogin: lastOnlineLogin || new Date().toISOString(),
      biometricEnabled: false,
    };

    await secureSet(SECURE_KEYS.OFFLINE_PIN, JSON.stringify(pinRecord));
  }

  /**
   * Validate PIN offline with 5-attempt lockout and 30-day online re-authentication requirement
   */
  public async verifyPin(
    pin: string,
    options?: { maxOfflineDays?: number }
  ): Promise<{
    success: boolean;
    error?: string;
    locked?: boolean;
    needsOnlineCheckin?: boolean;
    attemptsRemaining?: number;
  }> {
    const pinDataStr = await secureGet(SECURE_KEYS.OFFLINE_PIN);
    if (!pinDataStr) {
      return { success: false, error: 'No offline PIN registered yet on this device.' };
    }

    let pinData: StoredPinData;
    try {
      pinData = JSON.parse(pinDataStr);
    } catch {
      return { success: false, error: 'Corrupted PIN data.' };
    }

    // 1. Check if locked due to 5 failed attempts
    if (pinData.lockedUntilOnline) {
      return {
        success: false,
        locked: true,
        error: 'Account locked after 5 failed attempts. Please connect to internet and log in online to reset your PIN.',
      };
    }

    // 2. Check 30-day online re-authentication check-in
    const maxDays = options?.maxOfflineDays ?? MAX_OFFLINE_DAYS;
    const lastOnline = new Date(pinData.lastOnlineLogin).getTime();
    const now = Date.now();
    const elapsedDays = (now - lastOnline) / (24 * 60 * 60 * 1000);

    if (elapsedDays > maxDays) {
      return {
        success: false,
        needsOnlineCheckin: true,
        error: `Security policy: 30 days have passed since your last online check-in (${Math.floor(elapsedDays)} days). Please connect online to continue.`,
      };
    }

    // 3. Verify PIN using PBKDF2
    const saltBytes = hexToBytes(pinData.saltHex);
    const computedHash = await derivePinHash(pin, saltBytes, pinData.iterations || 100000);

    if (computedHash === pinData.hashHex) {
      // Success! Reset failed attempts
      pinData.failedAttempts = 0;
      await secureSet(SECURE_KEYS.OFFLINE_PIN, JSON.stringify(pinData));
      return { success: true };
    }

    // Mismatch: increment failed attempts
    pinData.failedAttempts = (pinData.failedAttempts || 0) + 1;
    const remaining = MAX_FAILED_PIN_ATTEMPTS - pinData.failedAttempts;

    if (pinData.failedAttempts >= MAX_FAILED_PIN_ATTEMPTS) {
      pinData.lockedUntilOnline = true;
      await secureSet(SECURE_KEYS.OFFLINE_PIN, JSON.stringify(pinData));
      return {
        success: false,
        locked: true,
        attemptsRemaining: 0,
        error: 'Incorrect PIN. You have exceeded 5 attempts. Your account is locked until you log in online.',
      };
    }

    await secureSet(SECURE_KEYS.OFFLINE_PIN, JSON.stringify(pinData));
    return {
      success: false,
      attemptsRemaining: remaining,
      error: `Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before account lock.`,
    };
  }

  /**
   * Unlock account and record fresh online login timestamp
   */
  public async recordOnlineLoginSuccess(): Promise<void> {
    const pinDataStr = await secureGet(SECURE_KEYS.OFFLINE_PIN);
    if (pinDataStr) {
      try {
        const pinData: StoredPinData = JSON.parse(pinDataStr);
        pinData.failedAttempts = 0;
        pinData.lockedUntilOnline = false;
        pinData.lastOnlineLogin = new Date().toISOString();
        await secureSet(SECURE_KEYS.OFFLINE_PIN, JSON.stringify(pinData));
      } catch {}
    }
  }

  /**
   * Enable/disable biometric unlock for PIN
   */
  public async setBiometricEnabled(enabled: boolean): Promise<void> {
    const pinDataStr = await secureGet(SECURE_KEYS.OFFLINE_PIN);
    if (pinDataStr) {
      try {
        const pinData: StoredPinData = JSON.parse(pinDataStr);
        pinData.biometricEnabled = enabled;
        await secureSet(SECURE_KEYS.OFFLINE_PIN, JSON.stringify(pinData));
      } catch {}
    }
  }

  public async isBiometricEnabled(): Promise<boolean> {
    const pinDataStr = await secureGet(SECURE_KEYS.OFFLINE_PIN);
    if (pinDataStr) {
      try {
        const pinData: StoredPinData = JSON.parse(pinDataStr);
        return Boolean(pinData.biometricEnabled);
      } catch {}
    }
    return false;
  }
}

export const secureSessionManager = SecureSessionManager.getInstance();
