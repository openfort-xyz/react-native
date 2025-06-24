import * as SecureStore from 'expo-secure-store';

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
  save(key: StorageKeys, value: string): void;
  remove(key: StorageKeys): void;
  flush(): void;
}

/**
 * Storage adapter using `expo-secure-store` intended for
 * use with `Openfort` class from `@openfort/openfort-js`.
 */
export const SecureStorageAdapter: OpenfortStorage = {
  async get(key: StorageKeys): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(normalizeKey(key), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    } catch (error) {
      console.warn('Failed to get item from secure store:', error);
      return null;
    }
  },

  save(key: StorageKeys, value: string): void {
    try {
      SecureStore.setItemAsync(normalizeKey(key), value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    } catch (error) {
      console.warn('Failed to set item in secure store:', error);
      throw error;
    }
  },

  remove(key: StorageKeys): void {
    try {
      SecureStore.deleteItemAsync(normalizeKey(key), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    } catch (error) {
      console.warn('Failed to delete item from secure store:', error);
      throw error;
    }
  },

  flush(): void {
    // SecureStore doesn't provide a way to list all keys
    // This is a no-op for secure store
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
export function createNormalizedStorage(customStorage?: OpenfortStorage): import('@openfort/openfort-js').Storage {
  const baseStorage = customStorage || SecureStorageAdapter;
  
  return {
    get(key: unknown): Promise<string | null> {
      // Convert the unknown key to our StorageKeys enum
      const storageKey = keyToStorageKeys(key);
      return baseStorage.get(storageKey);
    },
    
    save(key: unknown, value: string): void {
      const storageKey = keyToStorageKeys(key);
      baseStorage.save(storageKey, value);
    },
    
    remove(key: unknown): void {
      const storageKey = keyToStorageKeys(key);
      baseStorage.remove(storageKey);
    },
    
    flush(): void {
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