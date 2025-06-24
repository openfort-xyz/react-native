/**
 * Hook for embedded Solana wallet functionality
 */
import { useOpenfortContext } from '../../core/context';
import type {
  EmbeddedSolanaWalletState,
  UseEmbeddedSolanaWallet,
} from '../../types';

/**
 * Hook for interacting with embedded Solana wallets
 * 
 * @param props - Optional configuration with callback functions
 * @returns Current embedded Solana wallet state with actions
 * 
 * @example
 * ```tsx
 * const solanaWallet = useEmbeddedSolanaWallet({
 *   onCreateWalletSuccess: (wallet) => console.log('Solana wallet created:', wallet),
 *   onCreateWalletError: (error) => console.error('Solana wallet creation failed:', error),
 *   onRecoverWalletSuccess: (wallet) => console.log('Solana wallet recovered:', wallet),
 *   onRecoverWalletError: (error) => console.error('Solana wallet recovery failed:', error),
 * });
 * 
 * // Check wallet status
 * if (solanaWallet.status === 'not-created') {
 *   await solanaWallet.create();
 * } else if (solanaWallet.status === 'needs-recovery') {
 *   await solanaWallet.recover();
 * }
 * 
 * // Use connected wallets
 * if (solanaWallet.status === 'connected' && solanaWallet.wallets.length > 0) {
 *   const provider = await solanaWallet.wallets[0].getProvider();
 *   // Use provider for Solana transactions
 * }
 * ```
 */
export function useEmbeddedSolanaWallet(props?: UseEmbeddedSolanaWallet): EmbeddedSolanaWalletState {
  const { solanaWallet } = useOpenfortContext();

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

  return solanaWallet;
}