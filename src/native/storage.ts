/* eslint-disable @typescript-eslint/no-explicit-any */
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { logger } from '../lib/logger'

/**
 * Shape of messages sent from the embedded WebView when interacting with secure storage.
 */
export interface SecureStorageMessage {
  event: string
  id: string
  data: Record<string, any>
}

/**
 * Shape of responses returned to the WebView after processing a storage message.
 */
export interface SecureStorageResponse {
  event: string
  id: string
  data: Record<string, any>
}

/**
 * Checks if the provided value is a secure storage related message.
 *
 * @param message - Incoming message payload.
 * @returns `true` when the payload matches the {@link SecureStorageMessage} structure.
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
    return false
  }

  return (message as any).event.startsWith('app:secure-storage:')
}

/**
 * Handles secure storage operations initiated from WebView messages.
 *
 * @param message - Parsed WebView message describing the desired storage action.
 * @returns The response payload that should be sent back to the WebView.
 * @throws {Error} When the message event is unknown.
 */
export async function handleSecureStorageMessage(message: SecureStorageMessage): Promise<SecureStorageResponse> {
  logger.info('Handling secure storage message', message)
  switch (message.event) {
    case 'app:secure-storage:get': {
      const { key } = message.data
      try {
        const value = await SecureStore.getItemAsync(normalizeKey(key), {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        })

        return {
          event: message.event,
          id: message.id,
          data: { value },
        }
      } catch (error) {
        logger.warn('Failed to get the value from secure store', error)
        return {
          event: message.event,
          id: message.id,
          data: { value: null },
        }
      }
    }

    case 'app:secure-storage:set': {
      const { key, value } = message.data
      try {
        await SecureStore.setItemAsync(normalizeKey(key), value, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        })

        return {
          event: message.event,
          id: message.id,
          data: { success: true },
        }
      } catch (error) {
        logger.warn('Failed to write the value to secure store', error)
        return {
          event: message.event,
          id: message.id,
          data: { success: false },
        }
      }
    }

    case 'app:secure-storage:remove': {
      const { key } = message.data
      try {
        await SecureStore.deleteItemAsync(normalizeKey(key), {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        })

        return {
          event: message.event,
          id: message.id,
          data: { success: true },
        }
      } catch (error) {
        logger.warn('Failed to remove the value from secure store', error)
        return {
          event: message.event,
          id: message.id,
          data: { success: false },
        }
      }
    }

    case 'app:secure-storage:flush': {
      const { origin } = message.data
      try {
        // Systematically delete all known storage keys for this origin
        // These are the keys used by the iframe signature service
        const storageKeys = [
          'playerID',
          'chainId',
          'deviceID',
          'accountType',
          'address',
          'ownerAddress',
          'share',
          'account',
          'chainType',
          'signerId',
        ]

        const deletePromises = storageKeys.map(async (key) => {
          const fullKey = normalizeKey(`${origin}:${key}`)
          try {
            await SecureStore.deleteItemAsync(fullKey, {
              keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
            })
          } catch (error) {
            // Ignore errors for keys that don't exist
            logger.debug(`Key ${fullKey} not found during flush`, error)
          }
        })

        await Promise.all(deletePromises)
        logger.info('Flushed secure storage for origin', origin)

        return {
          event: message.event,
          id: message.id,
          data: { success: true },
        }
      } catch (error) {
        logger.warn('Failed to flush secure store', error)
        return {
          event: message.event,
          id: message.id,
          data: { success: false },
        }
      }
    }

    default:
      throw new Error(`Unknown secure storage event: ${message.event}`)
  }
}

/**
 * Normalises storage keys for compatibility with Expo Secure Store.
 *
 * @param key - Original storage key.
 * @returns The normalised key string.
 */
function normalizeKey(key: string): string {
  return key.replaceAll(':', '-')
}

/**
 * Native storage utilities for platform-specific operations.
 */
export const NativeStorageUtils = {
  /**
   * Checks if secure storage is available on the current platform.
   */
  isAvailable(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android'
  },

  /**
   * Gets the platform-specific storage options.
   */
  getStorageOptions(): SecureStore.SecureStoreOptions {
    return {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    }
  },

  /**
   * Safely checks if a key exists in secure storage.
   *
   * @param key - Storage key to look up.
   * @returns `true` if the key is present, otherwise `false`.
   */
  async keyExists(key: string): Promise<boolean> {
    try {
      const value = await SecureStore.getItemAsync(normalizeKey(key), this.getStorageOptions())
      return value !== null
    } catch {
      return false
    }
  },

  /**
   * Gets diagnostic information about the native storage capabilities.
   *
   * @returns Platform availability information and keychain accessibility value.
   */
  async getStorageInfo(): Promise<{
    isAvailable: boolean
    platform: string
    keychainAccessible: number
  }> {
    return {
      isAvailable: this.isAvailable(),
      platform: Platform.OS,
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    }
  },
}
