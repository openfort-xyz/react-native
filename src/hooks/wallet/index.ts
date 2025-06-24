/**
 * Wallet hooks index
 * 
 * This module re-exports all wallet-related hooks for convenient importing.
 */

// Embedded wallet hooks
export { useEmbeddedWallet } from './useEmbeddedWallet';

export { useEmbeddedEthereumWallet } from './useEmbeddedEthereumWallet';

export { useEmbeddedSolanaWallet } from './useEmbeddedSolanaWallet';


// Wallet recovery hooks
export { useSetEmbeddedWalletRecovery } from './useSetEmbeddedWalletRecovery';

export { useRecoverEmbeddedWallet } from './useRecoverEmbeddedWallet';
