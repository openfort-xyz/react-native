/**
 * Authentication hooks index.
 *
 * This module re-exports all authentication-related hooks for convenient importing.
 */

// Email authentication
export { useEmailAuth } from './useEmailAuth';

// OAuth authentication
export { useOAuth } from './useOAuth';

// Wallet-based authentication (SIWE)
export { useWalletAuth } from './useWalletAuth';

// Guest accounts
export { useGuestAuth } from './useGuestAuth';


export { useSignOut } from './useSignOut';