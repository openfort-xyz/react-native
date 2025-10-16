import { useWallets } from './useWallets'

/**
 * Hook for accessing the currently active embedded wallet
 *
 * This hook provides access to the currently active embedded wallet from the wallet collection.
 * It automatically updates when the active wallet changes through other wallet operations.
 *
 * @returns The active embedded wallet when available, otherwise `null`
 *
 * @example
 * ```tsx
 * const activeWallet = useWallet();
 *
 * // Check if wallet is available
 * if (activeWallet) {
 *   console.log('Active wallet address:', activeWallet.address);
 *
 *   // Get provider for transactions
 *   const provider = await activeWallet.getProvider();
 *
 *   // Use wallet for operations
 *   console.log('Wallet chain type:', activeWallet.chainType);
 *   console.log('Is connecting:', activeWallet.isConnecting);
 * } else {
 *   console.log('No active wallet available');
 * }
 * ```
 */
export function useWallet() {
  const { activeWallet } = useWallets()

  return activeWallet
}
