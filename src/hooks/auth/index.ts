/**
 * Authentication hooks index
 * 
 * This module re-exports all authentication-related hooks for convenient importing.
 */

// Email authentication
export { useLoginWithEmail } from './useLoginWithEmail';
export type { LoginWithEmailOptions, LoginWithEmailHookResult } from './useLoginWithEmail';

export { useLinkEmail } from './useLinkEmail';
export type { LinkWithEmailOptions, LinkWithEmailHookResult } from './useLinkEmail';

// OAuth authentication
export { useLoginWithOAuth } from './useLoginWithOAuth';
export { useLinkWithOAuth } from './useLinkWithOAuth';

// Wallet-based authentication (SIWE)
export { useLoginWithSiwe } from './useLoginWithSiwe';
export type { UseLoginWithSiweOptions, UseLoginWithSiwe } from './useLoginWithSiwe';

export { useLinkWithSiwe } from './useLinkWithSiwe';
export type { UseLinkWithSiweOptions, UseLinkWithSiwe } from './useLinkWithSiwe';


// Guest accounts
export { useCreateGuestAccount } from './useCreateGuestAccount';
export type { UseCreateGuestAccountOptions, UseCreateGuestAccount } from './useCreateGuestAccount';