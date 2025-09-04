/* eslint-disable @typescript-eslint/no-explicit-any */
import * as SecureStore from 'expo-secure-store';
import { NativeStorageUtils } from '../native';
import { logger } from '../lib/logger';
import { Storage } from '@openfort/openfort-js';

// Define the StorageKeys enum values that match the Openfort SDK
enum StorageKeys {
  AUTHENTICATION = 'openfort.authentication',
  SIGNER = 'openfort.signer',
  CONFIGURATION = 'openfort.configuration',
  ACCOUNT = 'openfort.account',
  TEST = 'openfort.test',
  RECOVERY = 'openfort.recovery',
  SESSION = 'openfort.session',
  PKCE_STATE = 'openfort.pkce_state',
  PKCE_VERIFIER = 'openfort.pkce_verifier'
}

// Create a proper Storage interface that matches what we need
interface OpenfortStorage {
  get(key: StorageKeys): Promise<string | null>;
  save(key: StorageKeys, value: string): Promise<void>;
  remove(key: StorageKeys): Promise<void>;
  flush(): void;

  // Additional utility methods using native storage utilities
  keyExists(key: StorageKeys): Promise<boolean>;
  getStorageInfo(): Promise<{
    isAvailable: boolean;
    platform: string;
    keychainAccessible: number;
  }>;
}

/**
 * Storage adapter using `expo-secure-store` intended for
 * use with `Openfort` class from `@openfort/openfort-js`.
 */
export const SecureStorageAdapter: OpenfortStorage = {
  async get(key: StorageKeys): Promise<string | null> {
    try {
      const normalizedKey = normalizeKey(key);

      const result = await SecureStore.getItemAsync(normalizedKey, NativeStorageUtils.getStorageOptions());

      // If result is a string (as expected), return it
      if (typeof result === 'string' || result === null) {
        return result;
      }

      // Handle unexpected Promise-like objects (shouldn't happen according to docs)
      if (result && typeof result === 'object' && '_j' in result) {
        logger.warn('WARNING: SecureStore returned a Promise-like object instead of a string');
        const actualValue = (result as any)._j;
        return typeof actualValue === 'string' ? actualValue : null;
      }

      // If we get here, something is wrong
      logger.error('Unexpected result type from SecureStore', result);
      return null;
    } catch (error) {
      logger.warn('Failed to get item from secure store', error);
      return null;
    }
  },

  async save(key: StorageKeys, value: string): Promise<void> {
    try {
      const normalizedKey = normalizeKey(key);
      await SecureStore.setItemAsync(normalizedKey, value, NativeStorageUtils.getStorageOptions());
    } catch (error) {
      logger.warn('Failed to set item in secure store', error);
      throw error;
    }
  },

  async remove(key: StorageKeys): Promise<void> {
    try {
      const normalizedKey = normalizeKey(key);
      await SecureStore.deleteItemAsync(normalizedKey, NativeStorageUtils.getStorageOptions());
    } catch (error) {
      logger.warn('Failed to delete item from secure store', error);
      throw error;
    }
  },

  flush(): void {
    // SecureStore doesn't provide a way to list all keys
    // This is a no-op for secure store
  },

  // Additional utility methods using native storage utilities
  async keyExists(key: StorageKeys): Promise<boolean> {
    const normalizedKey = normalizeKey(key);
    return await NativeStorageUtils.keyExists(normalizedKey);
  },

  async getStorageInfo(): Promise<{
    isAvailable: boolean;
    platform: string;
    keychainAccessible: number;
  }> {
    return await NativeStorageUtils.getStorageInfo();
  },
};

/**
 * Normalizes storage keys by replacing colons with hyphens
 * to ensure compatibility with expo-secure-store
 */
function normalizeKey(key: StorageKeys): string {
  return key.replaceAll(':', '-');
}

/**
 * Creates a type-safe storage adapter that bridges between the Openfort SDK's 
 * expected Storage interface and our React Native implementation
 */
export function createNormalizedStorage(customStorage?: OpenfortStorage): Storage {
  const baseStorage = customStorage || SecureStorageAdapter;

  return {
    async get(key: unknown): Promise<string | null> {
      // Convert the unknown key to our StorageKeys enum
      const storageKey = keyToStorageKeys(key);
      const result = await baseStorage.get(storageKey);
      return result;
    },

    save(key: unknown, value: string): void {
      logger.info(`Saving to storage key: ${key}, value: ${value}`);
      const storageKey = keyToStorageKeys(key);
      // Fire and forget - don't await as the SDK expects synchronous behavior
      baseStorage.save(storageKey, value).catch(error => {
        logger.error('Failed to save to storage', error);
      });
    },

    remove(key: unknown): void {
      logger.info(`Removing from storage key: ${key}`);
      const storageKey = keyToStorageKeys(key);
      // Fire and forget - don't await as the SDK expects synchronous behavior
      baseStorage.remove(storageKey).catch(error => {
        logger.error('Failed to remove from storage', error);
      });
    },

    flush(): void {
      logger.info('Flushing storage');
      baseStorage.flush();
    },
  };
}

/**
 * Converts an unknown key (likely from the Openfort SDK) to our StorageKeys enum
 */
function keyToStorageKeys(key: unknown): StorageKeys {
  if (typeof key === 'string') {
    // Check if the string matches one of our enum values
    const storageKey = Object.values(StorageKeys).find(value => value === key);
    if (storageKey) {
      return storageKey as StorageKeys;
    }
  }

  // If it's an enum-like object, try to get its value
  if (typeof key === 'object' && key !== null && 'toString' in key) {
    const keyString = key.toString();
    const storageKey = Object.values(StorageKeys).find(value => value === keyString);
    if (storageKey) {
      return storageKey as StorageKeys;
    }
  }

  // Fallback: throw an error for unknown keys
  throw new Error(`Unknown storage key: ${key}. Expected one of: ${Object.values(StorageKeys).join(', ')}`);
}