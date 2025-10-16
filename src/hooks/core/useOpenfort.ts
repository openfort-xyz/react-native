import { useOpenfortContext } from '../../core/context'
import type { UseOpenfort } from '../../types'

/**
 * Hook that exposes the core state of the Openfort SDK.
 *
 * This hook provides access to the current authenticated user object, SDK initialization status, and core authentication methods.
 *
 * @returns The Openfort SDK's core state and methods.
 *
 * @example
 * ```tsx
 * import { ActivityIndicator, Button, Text, View } from 'react-native';
 * import { useOpenfort } from '@openfort/react-native/hooks';
 *
 * export function HomeScreen() {
 *   const { user, isReady, error, logout } = useOpenfort();
 *
 *   if (!isReady) {
 *     return <ActivityIndicator size="large" />;
 *   }
 *
 *   if (error) {
 *     return <Text>{`Failed to initialise: ${error.message}`}</Text>;
 *   }
 *
 *   if (!user) {
 *     return <Text>Please sign in</Text>;
 *   }
 *
 *   return (
 *     <View>
 *       <Text>{`Welcome, ${user.id}`}</Text>
 *       <Button title="Log out" onPress={() => void logout()} />
 *     </View>
 *   );
 * }
 * ```
 */
export function useOpenfort(): UseOpenfort {
  const { user, isReady, error, logout, getAccessToken } = useOpenfortContext()

  return {
    user,
    isReady,
    error,
    logout,
    getAccessToken,
  }
}
