import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SQLCIPHER_KEY_STORAGE = 'cropcapture_sqlite_encryption_key_v1';

// Generate 256-bit cryptographically secure random hexadecimal key for SQLCipher
export function generate256BitKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// In-memory key store fallback for non-native / test environments
let inMemoryKey: string | null = null;

export class SecureKeyManager {
  private static instance: SecureKeyManager;
  private cachedKey: string | null = null;

  private constructor() {}

  public static getInstance(): SecureKeyManager {
    if (!SecureKeyManager.instance) {
      SecureKeyManager.instance = new SecureKeyManager();
    }
    return SecureKeyManager.instance;
  }

  /**
   * Retrieves or generates a 256-bit AES encryption key for SQLCipher
   * Stored securely in hardware-backed SecureStore (KeyStore on Android / Keychain on iOS)
   */
  public async getOrCreateDatabaseEncryptionKey(): Promise<string> {
    if (this.cachedKey) {
      return this.cachedKey;
    }

    try {
      const isAvailable = await SecureStore.isAvailableAsync();
      if (isAvailable) {
        let key = await SecureStore.getItemAsync(SQLCIPHER_KEY_STORAGE);
        if (!key) {
          key = generate256BitKey();
          await SecureStore.setItemAsync(SQLCIPHER_KEY_STORAGE, key, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          });
        }
        this.cachedKey = key;
        return key;
      }
    } catch (e) {
      console.warn('SecureStore unavailable for SQLCipher key, using device storage fallback:', e);
    }

    // Fallback for tests / web environments
    if (!inMemoryKey) {
      const stored = await AsyncStorage.getItem(`@secure_${SQLCIPHER_KEY_STORAGE}`);
      if (stored) {
        inMemoryKey = stored;
      } else {
        inMemoryKey = generate256BitKey();
        await AsyncStorage.setItem(`@secure_${SQLCIPHER_KEY_STORAGE}`, inMemoryKey);
      }
    }

    this.cachedKey = inMemoryKey;
    return inMemoryKey;
  }

  /**
   * Clears the cached key (used during wipe or testing)
   */
  public clearCache(): void {
    this.cachedKey = null;
    inMemoryKey = null;
  }
}

export const secureKeyManager = SecureKeyManager.getInstance();
