/**
 * Authentication hooks index.
 *
 * This module re-exports all authentication-related hooks for convenient importing.
 */

// Type exports
export type {
  EmailAuthResult,
  EmailVerificationResult,
  LinkEmailOptions,
  RequestResetPasswordOptions,
  ResetPasswordOptions,
  SignInEmailOptions,
  SignUpEmailOptions,
  UseEmailHookOptions,
  VerifyEmailOptions,
} from './useEmailAuth'

// Email authentication
export { useEmailAuth } from './useEmailAuth'
export type { GuestHookOptions, GuestHookResult } from './useGuestAuth'
// Guest accounts
export { useGuestAuth } from './useGuestAuth'
export type {
  AuthHookOptions,
  InitializeOAuthOptions,
  InitOAuthReturnType,
  StoreCredentialsResult,
} from './useOAuth'
// OAuth authentication
export { useOAuth } from './useOAuth'
export { useSignOut } from './useSignOut'
export type { WalletHookOptions, WalletHookResult } from './useWalletAuth'
// Wallet-based authentication (SIWE)
export { useWalletAuth } from './useWalletAuth'
