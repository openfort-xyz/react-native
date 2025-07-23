/**
 * Wallet hooks index
 * 
 * This module re-exports all wallet-related hooks for convenient importing.
 */

// Embedded wallet hooks
export { useEmbeddedEthereumWallet } from './useEmbeddedEthereumWallet';
export { useEmbeddedSolanaWallet } from './useEmbeddedSolanaWallet';

// Wallet recovery hooks
export { useRecoverEmbeddedWallet } from './useRecoverEmbeddedWallet';
export { useSetEmbeddedWalletRecovery } from './useSetEmbeddedWalletRecovery';
