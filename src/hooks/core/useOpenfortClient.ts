/**
 * Hook for accessing the Openfort client instance
 */
import type { Openfort as OpenfortClient } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';

/**
 * Hook for accessing the Openfort client instance directly
 * 
 * This hook provides access to the underlying Openfort client for advanced use cases
 * where you need direct access to the client methods.
 * 
 * @returns The Openfort client instance
 * 
 * @example
 * ```tsx
 * const client = useOpenfortClient();
 * 
 * // Use client methods directly
 * const customResult = await client.auth.customMethod();
 * 
 * // Access client configuration
 * console.log('App ID:', client.config.appId);
 * 
 * // Check client status
 * if (client.isInitialized) {
 *   // Perform operations that require initialization
 * }
 * ```
 */
export function useOpenfortClient(): OpenfortClient {
  const { client } = useOpenfortContext();

  return client;
}