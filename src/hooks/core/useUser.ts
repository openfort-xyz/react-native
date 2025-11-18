import { EmbeddedState } from '@openfort/openfort-js'
import { useOpenfortContext } from '../../core'

/**
 * Hook for accessing current user state and authentication status
 *
 * This hook provides access to the current user's information and authentication state.
 * It automatically updates when the user signs in, signs out, or their profile changes.
 *
 * @returns Current user data, authentication status, and access token getter
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated, getAccessToken } = useUser();
 *
 * // Check if user is authenticated
 * if (isAuthenticated && user) {
 *   console.log('Authenticated user:', user.id);
 *   console.log('User email:', user.email);
 *
 *   // Get access token for API calls
 *   const token = await getAccessToken();
 *   console.log('Access token available:', !!token);
 * } else {
 *   console.log('User not authenticated');
 * }
 *
 * // Use in conditional rendering
 * return isAuthenticated ? <Dashboard user={user} /> : <LoginForm />;
 * ```
 */
export function useUser() {
  const { user, embeddedState, getAccessToken } = useOpenfortContext()

  return {
    user,
    isAuthenticated: embeddedState !== EmbeddedState.NONE && embeddedState !== EmbeddedState.UNAUTHENTICATED,
    getAccessToken,
  }
}
