/**
 * Core Openfort hook for accessing SDK state and methods
 */
import { useOpenfortContext } from '../../core/context';
import { UseOpenfort } from '../../types';

/**
 * Hook that exposes the core state of the Openfort SDK
 * 
 * This hook provides access to the current authenticated user object,
 * SDK initialization status, and core authentication methods.
 * 
 * @returns The Openfort SDK's core state and methods
 * 
 * @example
 * ```tsx
 * const { user, isReady, error, logout, getAccessToken } = useOpenfort();
 * 
 * // Check if SDK is ready
 * if (!isReady) {
 *   return <LoadingSpinner />;
 * }
 * 
 * // Handle initialization errors
 * if (error) {
 *   return <ErrorDisplay error={error} />;
 * }
 * 
 * // Check authentication status
 * if (!user) {
 *   return <LoginScreen />;
 * }
 * 
 * // User is authenticated
 * return (
 *   <div>
 *     <h1>Welcome, {user.id}!</h1>
 *     <button onClick={logout}>Logout</button>
 *   </div>
 * );
 * ```
 */
export function useOpenfort(): UseOpenfort {
  const { user, isReady, error, logout, getAccessToken } = useOpenfortContext();

  return {
    user,
    isReady,
    error,
    logout,
    getAccessToken,
  };
}