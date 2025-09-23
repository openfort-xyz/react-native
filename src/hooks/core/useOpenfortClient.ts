/**
 * Hook for accessing the Openfort client instance
 */
import type { Openfort as OpenfortClient } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';

/**
 * Hook for accessing the Openfort client instance directly.
 *
 * This hook exposes the underlying {@link OpenfortClient} so that advanced consumer code
 * can access low-level methods that are not surfaced through the convenience hooks.
 *
 * @returns The current {@link OpenfortClient} instance from context.
 *
 * @example
 * ```tsx
 * const client = useOpenfortClient();
 *
 * // Invoke a raw SDK method
 * const token = await client.getAccessToken();
 *
 * // Access nested services
 * await client.auth.logout();
 * ```
 */
export function useOpenfortClient(): OpenfortClient {
  const { client } = useOpenfortContext();

  return client;
}