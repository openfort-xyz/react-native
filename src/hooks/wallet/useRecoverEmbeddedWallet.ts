/**
 * Hook for recovering embedded wallets
 */
import { useCallback } from 'react';
import { useOpenfortContext } from '../../core/context';
import type {
  RecoverParams,
  UseRecoverEmbeddedWallet,
} from '../../types';

/**
 * Hook for recovering embedded wallets
 * 
 * This hook uses the primary wallet of the user to recover all embedded wallets.
 * After recovery, you can use the wallet's getProvider() method to connect and use the wallet.
 * 
 * @returns Object with recover function
 * 
 * @example
 * ```tsx
 * const { recover } = useRecoverEmbeddedWallet();
 * const solanaWallet = useEmbeddedSolanaWallet();
 * 
 * // Recover with user passcode
 * await recover({
 *   recoveryMethod: 'password',
 *   password: 'user-password'
 * });
 * 
 * // After recovery, connect to the Solana wallet
 * await solanaWallet.getProvider();
 * 
 * // Recover with Openfort recovery
 * await recover({
 *   recoveryMethod: 'automatic'
 * });
 * ```
 */
export function useRecoverEmbeddedWallet(): UseRecoverEmbeddedWallet {
  const { client } = useOpenfortContext();

  const recover = useCallback(
    async (params: RecoverParams): Promise<void> => {
      try {
        await client.embedded.wallet.recover(params);
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to recover embedded wallet');
        throw errorObj;
      }
    },
    [client]
  );

  return {
    recover,
  };
}