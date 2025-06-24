import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Interface for secure storage message handling in WebView
 */
export interface SecureStorageMessage {
  event: string;
  id: string;
  data: Record<string, any>;
}

/**
 * Interface for secure storage response
 */
export interface SecureStorageResponse {
  event: string;
  id: string;
  data: Record<string, any>;
}

/**
 * Checks if a message is a secure storage related message
 */
export function isSecureStorageMessage(message: unknown): message is SecureStorageMessage {
  if (
    typeof message !== 'object' ||
    message === null ||
    !('event' in message) ||
    typeof (message as any).event !== 'string' ||
    !('id' in message) ||
    typeof (message as any).id !== 'string' ||
    !('data' in message) ||
    typeof (message as any).data !== 'object' ||
    (message as any).data === null
  ) {
    return false;
  }

  return (message as any).event.startsWith('app:secure-storage:');
}

/**
 * Handles secure storage operations from WebView messages
 */
export async function handleSecureStorageMessage(
  message: SecureStorageMessage
): Promise<SecureStorageResponse> {
  switch (message.event) {
    case 'app:secure-storage:get': {
      const { key } = message.data;
      try {
        const value = await SecureStore.getItemAsync(normalizeKey(key), {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        });

        return {
          event: message.event,
          id: message.id,
          data: { value },
        };
      } catch (error) {
        console.warn('Failed to get the value from secure store', error);
        return {
          event: message.event,
          id: message.id,
          data: { value: null },
        };
      }
    }

    case 'app:secure-storage:set': {
      const { key, value } = message.data;
      try {
        await SecureStore.setItemAsync(normalizeKey(key), value, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        });

        return {
          event: message.event,
          id: message.id,
          data: { success: true },
        };
      } catch (error) {
        console.warn('Failed to write the value to secure store', error);
        return {
          event: message.event,
          id: message.id,
          data: { success: false },
        };
      }
    }

    case 'app:secure-storage:remove': {
      const { key } = message.data;
      try {
        await SecureStore.deleteItemAsync(normalizeKey(key), {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        });

        return {
          event: message.event,
          id: message.id,
          data: { success: true },
        };
      } catch (error) {
        console.warn('Failed to remove the value from secure store', error);
        return {
          event: message.event,
          id: message.id,
          data: { success: false },
        };
      }
    }

    default:
      throw new Error(`Unknown secure storage event: ${message.event}`);
  }
}

/**
 * Normalizes storage keys for compatibility with secure storage
 */
function normalizeKey(key: string): string {
  return key.replaceAll(':', '-');
}

/**
 * Native storage utilities for platform-specific operations
 */
export const NativeStorageUtils = {
  /**
   * Checks if secure storage is available on the current platform
   */
  isAvailable(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  },

  /**
   * Gets the platform-specific storage options
   */
  getStorageOptions(): SecureStore.SecureStoreOptions {
    return {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    };
  },

  /**
   * Safely checks if a key exists in secure storage
   */
  async keyExists(key: string): Promise<boolean> {
    try {
      const value = await SecureStore.getItemAsync(normalizeKey(key), this.getStorageOptions());
      return value !== null;
    } catch {
      return false;
    }
  },

  /**
   * Gets all available storage information
   */
  async getStorageInfo(): Promise<{
    isAvailable: boolean;
    platform: string;
    keychainAccessible: number;
  }> {
    return {
      isAvailable: this.isAvailable(),
      platform: Platform.OS,
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    };
  },
};