/**
 * Hook for embedded Ethereum wallet functionality (deprecated)
 */
import { useOpenfortContext } from '../../core/context';
import type {
  EmbeddedWalletState,
  UseEmbeddedWallet,
} from '../../types';

/**
 * @deprecated Use the `useEmbeddedEthereumWallet` hook instead, in combination with
 * `useRecoverEmbeddedWallet` and `useSetEmbeddedWalletRecovery` for recovery specific needs.
 * 
 * Hook for interacting with embedded Ethereum wallets
 * 
 * @param props - Optional configuration with callback functions
 * @returns Current embedded wallet state with actions
 * 
 * @example
 * ```tsx
 * const walletState = useEmbeddedWallet({
 *   onCreateWalletSuccess: (wallet) => console.log('Wallet created:', wallet),
 *   onCreateWalletError: (error) => console.error('Wallet creation failed:', error),
 *   onRecoverWalletSuccess: (wallet) => console.log('Wallet recovered:', wallet),
 *   onRecoverWalletError: (error) => console.error('Wallet recovery failed:', error),
 * });
 * 
 * // Check wallet status
 * if (walletState.status === 'not-created') {
 *   await walletState.create();
 * } else if (walletState.status === 'needs-recovery') {
 *   await walletState.recover();
 * }
 * ```
 */
export function useEmbeddedWallet(props?: UseEmbeddedWallet): EmbeddedWalletState {
  const { wallet } = useOpenfortContext();

  // Store callbacks in refs if provided
  // Note: In a real implementation, these callbacks would be used
  // when wallet operations are performed
  if (props?.onCreateWalletSuccess) {
    // Store callback for wallet creation success
  }
  if (props?.onCreateWalletError) {
    // Store callback for wallet creation error
  }
  if (props?.onRecoverWalletSuccess) {
    // Store callback for wallet recovery success
  }
  if (props?.onRecoverWalletError) {
    // Store callback for wallet recovery error
  }
  if (props?.onSetWalletRecoverySuccess) {
    // Store callback for wallet recovery setting success
  }
  if (props?.onSetWalletRecoveryError) {
    // Store callback for wallet recovery setting error
  }

  return wallet;
}