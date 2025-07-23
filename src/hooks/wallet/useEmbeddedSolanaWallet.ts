/**
 * Hook for embedded Solana wallet functionality
 */
import { useCallback, useRef, useState, useEffect } from 'react';
import type { ShieldAuthentication, EmbeddedAccount } from '@openfort/openfort-js';
import { ShieldAuthType, EmbeddedState, RecoveryMethod } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';
import type {
  EmbeddedSolanaWalletState,
  UseEmbeddedSolanaWallet,
  ConnectedEmbeddedSolanaWallet,
} from '../../types';

/**
 * Hook for interacting with embedded Solana wallets
 * 
 * This hook manages embedded Solana wallets based on the user's state from the provider.
 * Wallet state is determined by polling in the provider, not by local state management.
 * 
 * @param props - Optional configuration with callback functions
 * @returns Current embedded Solana wallet state with actions
 * 
 * @example
 * ```tsx
 * const solanaWallet = useEmbeddedSolanaWallet({
 *   onCreateWalletSuccess: (result) => console.log('Solana wallet configured:', result),
 *   onCreateWalletError: (error) => console.error('Solana wallet configuration failed:', error),
 * });
 * 
 * // Check wallet status and configure if needed
 * if (solanaWallet.status === 'disconnected') {
 *   await solanaWallet.create(); // Uses default chain
 *   // Or with specific chain: await solanaWallet.create({ chainId: 101 });
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
  const { client, user, supportedChains, embeddedWallet, embeddedState, _internal } = useOpenfortContext();
  const callbacksRef = useRef(props);
  const [embeddedAccounts, setEmbeddedAccounts] = useState<EmbeddedAccount[]>([]);
  callbacksRef.current = props;

  // Fetch embedded wallets using embeddedWallet.list()
  const fetchEmbeddedWallets = useCallback(async () => {
    if (!client || embeddedState === EmbeddedState.NONE || embeddedState === EmbeddedState.UNAUTHENTICATED) {
      setEmbeddedAccounts([]);
      return;
    }

    try {
      const accounts = await client.embeddedWallet.list();
      setEmbeddedAccounts(accounts);
    } catch (error) {
      setEmbeddedAccounts([]);
    }
  }, [client, embeddedState, user]);

  useEffect(() => {
    fetchEmbeddedWallets();
  }, [fetchEmbeddedWallets]);

  // Extract Solana wallets from embedded accounts
  const wallets: ConnectedEmbeddedSolanaWallet[] = embeddedAccounts
    .filter(account => account.chainType === 'solana')
    .map((account, index) => ({
      address: account.address,
      walletIndex: index,
      chainType: 'solana' as const,
      getProvider: async () => {
        // TODO: Implement getSolanaProvider when available
        throw new Error('Solana provider not yet implemented');
      },
    }));

  const create = useCallback(
    async (opts?: { chainId?: number; recoveryPassword?: string }): Promise<EmbeddedAccount> => {
      try {
        // Validate chainId if provided
        let chainId: number | undefined;
        if (opts?.chainId) {
          if (!supportedChains || !supportedChains.some(chain => chain.id === opts.chainId)) {
            throw new Error(`Chain ID ${opts.chainId} is not supported. Supported chains: ${supportedChains?.map(c => c.id).join(', ') || 'none'}`);
          }
          chainId = opts.chainId;
        } else if (supportedChains && supportedChains.length > 0) {
          // Use the first supported chain as default
          chainId = supportedChains[0].id;
        }

        // Create shield authentication object
        let shieldAuthentication: ShieldAuthentication | null = null;
        if (embeddedWallet) {
          const accessToken = await client.getAccessToken();
          if (!accessToken) {
            throw new Error('Access token is required for shield authentication');
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

        // Configure embedded wallet with shield authentication
        const embeddedAccount = await client.embeddedWallet.configure({
          chainId,
          shieldAuthentication: shieldAuthentication ?? undefined,
          recoveryParams: opts?.recoveryPassword ? { password: opts.recoveryPassword, recoveryMethod: RecoveryMethod.PASSWORD } : undefined
        });

        // Refetch the list of wallets to ensure the state is up to date
        await fetchEmbeddedWallets();

        // Notify success callback
        callbacksRef.current?.onCreateWalletSuccess?.(embeddedAccount);

        return embeddedAccount;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to configure Solana wallet');
        callbacksRef.current?.onCreateWalletError?.(errorObj);
        throw errorObj;
      }
    },
    [client, supportedChains, embeddedWallet, _internal, user, fetchEmbeddedWallets]
  );

  // Check if user has any Ethereum wallet accounts
  const hasWallets = wallets.length > 0;

  // Return state based on embeddedState from provider
  switch (embeddedState) {
    case EmbeddedState.NONE:
    case EmbeddedState.UNAUTHENTICATED:
      return {
        status: 'disconnected',
        account: null,
        wallets,
        create,
      };

    case EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED:
      if (hasWallets && wallets[0]) {
        return {
          status: 'needs-recovery',
          account: {
            address: wallets[0].address,
            chainType: 'solana',
            walletIndex: wallets[0].walletIndex,
          },
          wallets,
          create,
        };
      } else {
        return {
          status: 'disconnected',
          account: null,
          wallets,
          create,
        };
      }

    case EmbeddedState.CREATING_ACCOUNT:
      return {
        status: 'creating',
        account: null,
        wallets,
        create,
      };

    case EmbeddedState.READY:
      if (!hasWallets || wallets.length === 0) {
        return {
          status: 'disconnected',
          account: null,
          wallets,
          create,
        };
      }

      const firstWallet = wallets[0];
      return {
        status: 'connected',
        account: {
          address: firstWallet.address,
          chainType: 'solana',
          walletIndex: firstWallet.walletIndex,
        },
        provider: (() => client.embeddedWallet.getEthereumProvider()) as any,
        wallets,
        create,
      };

    default:
      // Fallback for unknown states
      return {
        status: 'error',
        account: null,
        error: `Unknown embedded state: ${embeddedState}`,
        wallets,
        create,
      };
  }
}