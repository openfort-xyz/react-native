/**
 * Hook for recovering embedded wallets
 */
import { useCallback, useRef } from 'react';
import type { ShieldAuthentication, EmbeddedAccount } from '@openfort/openfort-js';
import { RecoveryMethod, ShieldAuthType } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';

/**
 * Recovery parameters for embedded wallets
 */
export interface RecoverParams {
  /** Chain ID for the wallet (optional, uses first supported chain if not provided) */
  chainId?: number;
  accountIndex?: number;
  /** Recovery password for password-based recovery */
  recoveryPassword?: string;
}

/**
 * Result interface for wallet recovery
 */
export interface UseRecoverEmbeddedWallet {
  /** Recovers an existing embedded wallet */
  recover: (params?: RecoverParams) => Promise<EmbeddedAccount>;
}

/**
 * Hook for recovering embedded wallets
 * 
 * This hook allows users to recover their existing embedded wallets using
 * either automatic recovery or password-based recovery methods.
 * 
 * @returns Object with recover function
 * 
 * @example
 * ```tsx
 * const { recover } = useRecoverEmbeddedWallet();
 * 
 * // Recover with password
 * try {
 *   const { user } = await recover({
 *     recoveryPassword: 'user-recovery-password'
 *   });
 *   console.log('Wallet recovered for user:', user.id);
 * } catch (error) {
 *   console.error('Recovery failed:', error);
 * }
 * 
 * // Recover with automatic recovery (if configured)
 * try {
 *   const { user } = await recover();
 *   console.log('Wallet automatically recovered for user:', user.id);
 * } catch (error) {
 *   console.error('Automatic recovery failed:', error);
 * }
 * 
 * // Recover with specific chain
 * const { user } = await recover({
 *   chainId: 1, // Ethereum mainnet
 *   recoveryPassword: 'user-recovery-password'
 * });
 * 
 * // Recover a specific account
 * const { user } = await recover({
 *   accountIndex: 0,
 *   recoveryPassword: 'user-recovery-password'
 * });
 * ```
 */
export function useRecoverEmbeddedWallet(): UseRecoverEmbeddedWallet {
  const { client, supportedChains, embeddedWallet, _internal } = useOpenfortContext();
  const recoverPromiseRef = useRef<Promise<EmbeddedAccount> | null>(null);

  const recover = useCallback(
    async (params?: RecoverParams): Promise<EmbeddedAccount> => {
      // If there's already a recovery in progress, return the existing promise
      if (recoverPromiseRef.current) {
        return recoverPromiseRef.current;
      }

      // Create and store the recovery promise
      recoverPromiseRef.current = (async (): Promise<EmbeddedAccount> => {
        try {
          // Validate chainId if provided
          let chainId: number | undefined;
          if (params?.chainId) {
            if (!supportedChains || !supportedChains.some(chain => chain.id === params.chainId)) {
              throw new Error(`Chain ID ${params.chainId} is not supported. Supported chains: ${supportedChains?.map(c => c.id).join(', ') || 'none'}`);
            }
            chainId = params.chainId;
          } else if (supportedChains && supportedChains.length > 0) {
            // Use the first supported chain as default
            chainId = supportedChains[0].id;
          }

          // Create shield authentication object
          let shieldAuthentication: ShieldAuthentication | null = null;
          if (embeddedWallet) {
            const accessToken = await client.getAccessToken();
            if (!accessToken) {
              throw new Error('Access token is required for wallet recovery');
            }

            // Get encryption session from embedded wallet configuration
            let encryptionSession: string | undefined;
            if ('getEncryptionSession' in embeddedWallet && embeddedWallet.getEncryptionSession) {
              encryptionSession = await embeddedWallet.getEncryptionSession();
            }

            shieldAuthentication = {
              auth: ShieldAuthType.OPENFORT,
              token: accessToken,
              ...(encryptionSession && { encryptionSession }),
            };
          }

          // Recover the embedded wallet with shield authentication
          const embeddedAccount = await client.embeddedWallet.configure({
            chainId,
            shieldAuthentication: shieldAuthentication ?? undefined,
            recoveryParams: params?.recoveryPassword ? { password: params.recoveryPassword, recoveryMethod: RecoveryMethod.PASSWORD } : undefined
          });

          return embeddedAccount;
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error('Failed to recover embedded wallet');
          throw errorObj;
        } finally {
          // Clear the promise reference when done (success or failure)
          recoverPromiseRef.current = null;
        }
      })();

      return recoverPromiseRef.current;
    },
    [client, supportedChains, embeddedWallet, _internal]
  );

  return {
    recover,
  };
}