import { useWallets } from "./useWallets";

/**
 * Hook for accessing the currently active embedded wallet.
 *
 * @returns The active embedded wallet when available, otherwise `null`.
 */
export function useWallet() {
  const { activeWallet } = useWallets();

  return activeWallet;
}
