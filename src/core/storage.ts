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
 * Creates a storage adapter that bridges the Openfort SDK storage API with the React Native implementation.
 * The core SDK's ScopedStorage handles key scoping, so this adapter simply passes keys through.
 *
 * @param _publishableKey - Unused. Key scoping is handled by the core SDK.
 * @param customStorage - Optional custom storage implementation. When omitted the {@link SecureStorageAdapter} is used.
 * @returns An object that satisfies the {@link Storage} interface expected by `@openfort/openfort-js`.
 */
export function createNormalizedStorage(_publishableKey: string, customStorage?: OpenfortStorage): Storage {
  const baseStorage = customStorage || SecureStorageAdapter

  return {
    async get(key: unknown): Promise<string | null> {
      const keyString = String(key)
      return baseStorage.get(keyString)
    },

    save(key: unknown, value: string): void {
      const keyString = String(key)
      // Fire and forget - don't await as the SDK expects synchronous behavior
      baseStorage.save(keyString, value).catch((error) => {
        logger.error('Failed to save to storage', error)
      })
    },

    remove(key: unknown): void {
      const keyString = String(key)
      // Fire and forget - don't await as the SDK expects synchronous behavior
      baseStorage.remove(keyString).catch((error) => {
        logger.error('Failed to remove from storage', error)
      })
    },

    flush(): void {
      baseStorage.flush()
    },
  }
}
