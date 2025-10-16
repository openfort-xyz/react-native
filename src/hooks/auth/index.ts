/**
 * Authentication hooks index.
 *
 * This module re-exports all authentication-related hooks for convenient importing.
 */

// Email authentication
export { useEmailAuth } from './useEmailAuth'
// Guest accounts
export { useGuestAuth } from './useGuestAuth'
// OAuth authentication
export { useOAuth } from './useOAuth'
export { useSignOut } from './useSignOut'
// Wallet-based authentication (SIWE)
export { useWalletAuth } from './useWalletAuth'
