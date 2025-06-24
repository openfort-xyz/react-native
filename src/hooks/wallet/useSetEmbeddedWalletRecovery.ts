/**
 * Hook for setting embedded wallet recovery methods
 */
import { useCallback } from 'react';
import { useOpenfortContext } from '../../core/context';
import type {
  SetRecoveryParams,
  UseSetEmbeddedWalletRecoveryResult,
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
 * // Set user passcode recovery
 * const { user } = await setRecovery({
 *   recoveryMethod: 'user-passcode',
 *   password: 'secure-password-123'
 * });
 * 
 * // Set Google Drive recovery
 * const result = await setRecovery({
 *   recoveryMethod: 'google-drive'
 * });
 * // Note: result.user may be null if flow is deferred for Google Drive
 * 
 * // Set iCloud recovery
 * await setRecovery({
 *   recoveryMethod: 'icloud'
 * });
 * 
 * // Set recovery encryption key
 * await setRecovery({
 *   recoveryMethod: 'recovery-encryption-key',
 *   recoveryKey: 'user-generated-key'
 * });
 * 
 * // Set Openfort recovery
 * await setRecovery({
 *   recoveryMethod: 'Openfort'
 * });
 * ```
 */
export function useSetEmbeddedWalletRecovery(): UseSetEmbeddedWalletRecovery {
  const { client } = useOpenfortContext();

  const setRecovery = useCallback(
    async (params: SetRecoveryParams): Promise<UseSetEmbeddedWalletRecoveryResult> => {
      try {
        const result = await client.embedded.wallet.setRecovery(params);

        return {
          user: result.user || null,
        };
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to set wallet recovery');
        throw errorObj;
      }
    },
    [client]
  );

  return {
    setRecovery,
  };
}