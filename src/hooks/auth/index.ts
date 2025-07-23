/**
 * Authentication hooks index
 * 
 * This module re-exports all authentication-related hooks for convenient importing.
 */

// Email authentication
export { useLoginWithEmail } from './useLoginWithEmail';

export { useLinkEmail } from './useLinkEmail';

// OAuth authentication
export { useLoginWithOAuth } from './useLoginWithOAuth';
export { useLinkWithOAuth } from './useLinkWithOAuth';

// Wallet-based authentication (SIWE)
export { useLoginWithSiwe } from './useLoginWithSiwe';

export { useLinkWithSiwe } from './useLinkWithSiwe';


// Guest accounts
export { useCreateGuestAccount } from './useCreateGuestAccount';