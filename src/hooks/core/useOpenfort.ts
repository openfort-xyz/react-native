/**
 * Core Openfort hook for accessing SDK state and methods
 */
import { useOpenfortContext } from '../../core/context';
import { UseOpenfort } from '../../types';

/**
 * Hook that exposes the comprehensive state of the Openfort SDK
 * 
 * This hook provides access to all Openfort SDK functionality including
 * user state, authentication, OAuth providers, and wallet management.
 * 
 * @returns The complete Openfort SDK state and methods
 * 
 * @example
 * ```tsx
 * const { 
 *   user, 
 *   isReady, 
 *   error, 
 *   logout, 
 *   getAccessToken,
 *   signUpGuest,
 *   signInWithProvider,
 *   wallets,
 *   createWallet,
 *   activeWallet,
 *   isProviderLinked,
 *   linkProvider
 * } = useOpenfort();
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
 *     <p>Active Wallet: {activeWallet?.address}</p>
 *     <button onClick={logout}>Logout</button>
 *   </div>
 * );
 * ```
 */
export function useOpenfort(): UseOpenfort {
  const context = useOpenfortContext();

  return {
    // Core state
    user: context.user,
    isReady: context.isReady,
    error: context.error,
    logout: context.logout,
    getAccessToken: context.getAccessToken,

    // OAuth provider functionality
    isProviderLoading: context.isProviderLoading,
    isProviderLinked: context.isProviderLinked,
    linkProvider: context.linkProvider,

    // Authentication functionality
    signUpGuest: context.signUpGuest,
    signInWithProvider: context.signInWithProvider,
    isAuthenticating: context.isAuthenticating,
    authError: context.authError,
    signOut: context.signOut,

    // User functionality
    isUserReady: context.isUserReady,
    userError: context.userError,

    // Wallet functionality
    wallets: context.wallets,
    setActiveWallet: context.setActiveWallet,
    createWallet: context.createWallet,
    activeWallet: context.activeWallet,
    isCreatingWallet: context.isCreatingWallet,
    signMessage: context.signMessage,
    switchChain: context.switchChain,
    isSwitchingChain: context.isSwitchingChain,
  };
}