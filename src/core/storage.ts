/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Storage } from '@openfort/openfort-js'
import * as SecureStore from 'expo-secure-store'
import { logger } from '../lib/logger'
import { NativeStorageUtils } from '../native'

/**
 * Tracks pending write operations per key.
 * This ensures `get` waits for any in-flight `save` to complete,
 * providing read-after-write consistency while keeping `save` synchronous.
 */
const pendingWrites = new Map<string, Promise<void>>()

/**
 * Creates a scope prefix from the publishable key.
 * Extracts the unique project identifier after the "pk_test_" or "pk_live_" prefix.
 * Uses the first 8 characters of that unique part to keep keys readable.
 *
 * e.g., "pk_test_abc123xyz789" -> "abc123xy"
 */
function createScope(publishableKey: string): string {
  // Remove the "pk_test_" or "pk_live_" prefix (8 characters)
  const uniquePart = publishableKey.substring(8)
  // Use first 8 characters of the unique part as scope
  return uniquePart.substring(0, 8)
}

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
  PKCE_VERIFIER = 'openfort.pkce_verifier',
}

// Create a proper Storage interface that matches what we need
interface OpenfortStorage {
  get(key: string): Promise<string | null>
  save(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
  flush(): void

  // Additional utility methods using native storage utilities
  keyExists(key: string): Promise<boolean>
  getStorageInfo(): Promise<{
    isAvailable: boolean
    platform: string
    keychainAccessible: number
  }>
}

/**
 * Storage adapter backed by {@link SecureStore} that matches the {@link Storage} interface expected by `@openfort/openfort-js`.
 *
 * The adapter normalises the keys provided by the Openfort SDK so they can be safely persisted via Expo Secure Store.
 */
export const SecureStorageAdapter: OpenfortStorage = {
  async get(key: string): Promise<string | null> {
    try {
      const normalizedKey = normalizeKey(key)

      // Wait for any pending write to complete before reading
      const pendingWrite = pendingWrites.get(normalizedKey)
      if (pendingWrite) {
        await pendingWrite
      }

      const result = await SecureStore.getItemAsync(normalizedKey, NativeStorageUtils.getStorageOptions())

      // If result is a string (as expected), return it
      if (typeof result === 'string' || result === null) {
        return result
      }

      // Handle unexpected Promise-like objects (shouldn't happen according to docs)
      if (result && typeof result === 'object' && '_j' in result) {
        logger.warn('WARNING: SecureStore returned a Promise-like object instead of a string')
        const actualValue = (result as any)._j
        return typeof actualValue === 'string' ? actualValue : null
      }

      // If we get here, something is wrong
      logger.error('Unexpected result type from SecureStore', result)
      return null
    } catch (error) {
      logger.warn('Failed to get item from secure store', error)
      return null
    }
  },

  async save(key: string, value: string): Promise<void> {
    const normalizedKey = normalizeKey(key)
    const writePromise = (async () => {
      try {
        await SecureStore.setItemAsync(normalizedKey, value, NativeStorageUtils.getStorageOptions())
      } catch (error) {
        logger.warn('Failed to set item in secure store', error)
        throw error
      } finally {
        pendingWrites.delete(normalizedKey)
      }
    })()
    pendingWrites.set(normalizedKey, writePromise)
    return writePromise
  },

  async remove(key: string): Promise<void> {
    try {
      const normalizedKey = normalizeKey(key)
      await SecureStore.deleteItemAsync(normalizedKey, NativeStorageUtils.getStorageOptions())
    } catch (error) {
      logger.warn('Failed to delete item from secure store', error)
      throw error
    }
  },

  flush(): void {
    // SecureStore doesn't provide a way to list all keys
    // This is a no-op for secure store
  },

  // Additional utility methods using native storage utilities
  async keyExists(key: string): Promise<boolean> {
    const normalizedKey = normalizeKey(key)
    return await NativeStorageUtils.keyExists(normalizedKey)
  },

  async getStorageInfo(): Promise<{
    isAvailable: boolean
    platform: string
    keychainAccessible: number
  }> {
    return await NativeStorageUtils.getStorageInfo()
  },
}

/**
 * Normalizes an Openfort storage key for use with Expo Secure Store.
 *
 * @param key - The key provided by the Openfort SDK.
 * @returns A key that is safe to use with Expo Secure Store.
 */
function normalizeKey(key: string): string {
  return key.replaceAll(':', '-')
}

/**
 * Creates a type-safe storage adapter that bridges the Openfort SDK storage API with the React Native implementation.
 * Storage keys are scoped by publishable key to isolate data between different projects.
 *
 * @param publishableKey - The publishable key used to scope storage keys.
 * @param customStorage - Optional custom storage implementation. When omitted the {@link SecureStorageAdapter} is used.
 * @returns An object that satisfies the {@link Storage} interface expected by `@openfort/openfort-js`.
 */
export function createNormalizedStorage(publishableKey: string, customStorage?: OpenfortStorage): Storage {
  const baseStorage = customStorage || SecureStorageAdapter
  const scope = createScope(publishableKey)

  /**
   * Prefixes a storage key with the scope.
   * e.g., "openfort.authentication" -> "abc123xy.openfort.authentication"
   */
  function scopeKey(key: StorageKeys): string {
    return `${scope}.${key}`
  }

  return {
    async get(key: unknown): Promise<string | null> {
      // Convert the unknown key to our StorageKeys enum
      const storageKey = keyToStorageKeys(key)
      const scopedKey = scopeKey(storageKey)
      const result = await baseStorage.get(scopedKey)
      return result
    },

    save(key: unknown, value: string): void {
      logger.info(`Saving to storage key: ${key}, value: ${value}`)
      const storageKey = keyToStorageKeys(key)
      const scopedKey = scopeKey(storageKey)
      // Fire and forget - don't await as the SDK expects synchronous behavior
      baseStorage.save(scopedKey, value).catch((error) => {
        logger.error('Failed to save to storage', error)
      })
    },

    remove(key: unknown): void {
      logger.info(`Removing from storage key: ${key}`)
      const storageKey = keyToStorageKeys(key)
      const scopedKey = scopeKey(storageKey)
      // Fire and forget - don't await as the SDK expects synchronous behavior
      baseStorage.remove(scopedKey).catch((error) => {
        logger.error('Failed to remove from storage', error)
      })
    },

    flush(): void {
      logger.info('Flushing storage')
      // Remove all scoped keys for this project
      for (const key of Object.values(StorageKeys)) {
        const scopedKey = scopeKey(key)
        baseStorage.remove(scopedKey).catch((error) => {
          logger.error('Failed to remove from storage during flush', error)
        })
      }
    },
  }
}

/**
 * Converts a key provided by the Openfort SDK to the local {@link StorageKeys} enum.
 *
 * @param key - Value provided by the Openfort SDK. Can be a string or an enum-like
 * object.
 * @returns The matching {@link StorageKeys} value.
 * @throws {Error} When the key cannot be mapped to one of the known storage keys.
 */
function keyToStorageKeys(key: unknown): StorageKeys {
  if (typeof key === 'string') {
    // Check if the string matches one of our enum values
    const storageKey = Object.values(StorageKeys).find((value) => value === key)
    if (storageKey) {
      return storageKey as StorageKeys
    }
  }

  // If it's an enum-like object, try to get its value
  if (typeof key === 'object' && key !== null && 'toString' in key) {
    const keyString = key.toString()
    const storageKey = Object.values(StorageKeys).find((value) => value === keyString)
    if (storageKey) {
      return storageKey as StorageKeys
    }
  }

  // Fallback: throw an error for unknown keys
  throw new Error(`Unknown storage key: ${key}. Expected one of: ${Object.values(StorageKeys).join(', ')}`)
}
