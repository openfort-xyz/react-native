/**
 * Hook for setting embedded wallet recovery methods
 */
import { useCallback } from 'react';
import { RecoveryMethod, type EmbeddedAccount } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';
import type {
  SetRecoveryParams,
  UseSetEmbeddedWalletRecovery,
} from '../../types';

/**
 * Hook for setting the recovery method of embedded wallets
 * 
 * @returns Object with setRecovery function
 * 
 * @example
 * ```tsx
 * const { setRecovery } = useSetEmbeddedWalletRecovery();
 * 
 * // Set password recovery
 * const { user } = await setRecovery({
 *   recoveryMethod: 'password',
 *   password: 'secure-password-123'
 * });
 * 
 * 
 * // Set automatic recovery
 * await setRecovery({
 *   recoveryMethod: 'automatic'
 * });
 * ```
 */
export function useSetEmbeddedWalletRecovery(): UseSetEmbeddedWalletRecovery {
  const { client, _internal } = useOpenfortContext();

  const setRecovery = useCallback(
    async (params: SetRecoveryParams): Promise<EmbeddedAccount> => {
      try {
        // Set embedded wallet recovery method
        if (params.recoveryMethod === 'password') {
          await client.embeddedWallet.setEmbeddedRecovery({
            recoveryMethod: RecoveryMethod.PASSWORD,
            recoveryPassword: params.password
          });
        } else {
          await client.embeddedWallet.setEmbeddedRecovery({
            recoveryMethod: RecoveryMethod.AUTOMATIC
          });
        }

        // Get the updated embedded account
        const embeddedAccount = await client.embeddedWallet.get();

        // Refresh user state to reflect recovery changes
        await _internal.refreshUserState();

        return embeddedAccount;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to set wallet recovery');
        throw errorObj;
      }
    },
    [client, _internal]
  );

  return {
    setRecovery,
  };
}