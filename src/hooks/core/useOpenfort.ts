import { useOpenfortContext } from '../../core/context'
import type { UseOpenfort } from '../../types'

/**
 * Hook that exposes the core state of the Openfort SDK.
 *
 * This hook provides access to the current SDK initialization status.
 *
 * @returns The Openfort SDK's core state and methods.
 *
 * @example
 * ```tsx
 * import { ActivityIndicator, Button, Text, View } from 'react-native';
 * import { useOpenfort } from '@openfort/react-native/hooks';
 *
 * export function HomeScreen() {
 *   const { isReady, error } = useOpenfort();
 *
 *   if (!isReady) {
 *     return <ActivityIndicator size="large" />;
 *   }
 *
 *   if (error) {
 *     return <Text>{`Failed to initialise: ${error.message}`}</Text>;
 *   }
 *
 * ```
 */
export function useOpenfort(): UseOpenfort {
  const { isReady, error } = useOpenfortContext()

  return {
    isReady,
    error,
  }
}
