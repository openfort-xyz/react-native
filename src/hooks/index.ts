/**
 * Openfort React Native SDK Hooks
 * 
 * This module provides a comprehensive set of React hooks for integrating
 * with the Openfort platform in React Native applications.
 * 
 * The hooks are organized into the following categories:
 * - Core: Core SDK functionality hooks
 */

// Re-export all core hooks
export * from './core';

// Re-export all authentication hooks
export * from './auth';

// Re-export all wallet hooks
export * from './wallet';


/**
 * Hook categories for organized imports
 * 
 * You can import hooks by category for better organization:
 * 
 * @example
 * ```tsx
 * import { auth, wallet, core } from '@openfort/react-native';
 * 
 * // Use categorized hooks
 * const { login } = auth.useLoginWithEmail();
 * const { wallets } = wallet.useEmbeddedEthereumWallet();
 * const { user } = core.useOpenfort();
 * ```
 */
export const auth = {
    useLoginWithEmail: () => import('./auth/useLoginWithEmail').then(m => m.useLoginWithEmail),
    useLoginWithOAuth: () => import('./auth/useLoginWithOAuth').then(m => m.useLoginWithOAuth),
    useLoginWithSiwe: () => import('./auth/useLoginWithSiwe').then(m => m.useLoginWithSiwe),
    useLinkEmail: () => import('./auth/useLinkEmail').then(m => m.useLinkEmail),
    useLinkWithOAuth: () => import('./auth/useLinkWithOAuth').then(m => m.useLinkWithOAuth),
    useLinkWithSiwe: () => import('./auth/useLinkWithSiwe').then(m => m.useLinkWithSiwe),
    useCreateGuestAccount: () => import('./auth/useCreateGuestAccount').then(m => m.useCreateGuestAccount),
};

export const wallet = {
    useEmbeddedEthereumWallet: () => import('./wallet/useEmbeddedEthereumWallet').then(m => m.useEmbeddedEthereumWallet),
    useEmbeddedSolanaWallet: () => import('./wallet/useEmbeddedSolanaWallet').then(m => m.useEmbeddedSolanaWallet),
    useRecoverEmbeddedWallet: () => import('./wallet/useRecoverEmbeddedWallet').then(m => m.useRecoverEmbeddedWallet),
    useSetEmbeddedWalletRecovery: () => import('./wallet/useSetEmbeddedWalletRecovery').then(m => m.useSetEmbeddedWalletRecovery),
};

export const core = {
    useOpenfort: () => import('./core/useOpenfort').then(m => m.useOpenfort),
    useOpenfortClient: () => import('./core/useOpenfortClient').then(m => m.useOpenfortClient),
};