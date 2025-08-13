/**
 * Hook for embedded Ethereum wallet functionality
 */
import { useCallback, useRef, useState, useEffect } from 'react';
import { ShieldAuthentication, ShieldAuthType, EmbeddedState, type EmbeddedAccount, RecoveryMethod, ChainTypeEnum } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';
import type {
  EmbeddedEthereumWalletState,
  UseEmbeddedEthereumWallet,
  ConnectedEmbeddedEthereumWallet,
} from '../../types';

/**
 * Hook for interacting with embedded Ethereum wallets
 * 
 * This hook manages embedded Ethereum wallets based on the user's state from the provider.
 * Wallet state is determined by polling in the provider, not by local state management.
 * 
 * @param props - Optional configuration with callback functions
 * @returns Current embedded Ethereum wallet state with actions
 * 
 * @example
 * ```tsx
 * const ethereumWallet = useEmbeddedEthereumWallet({
 *   onCreateWalletSuccess: (provider) => console.log('Ethereum wallet created:', provider),
 *   onCreateWalletError: (error) => console.error('Ethereum wallet creation failed:', error),
 * });
 * 
 * // Check wallet status and create if needed
 * if (ethereumWallet.status === 'disconnected') {
 *   await ethereumWallet.create(); // Uses default chain
 *   // Or with specific chain: await ethereumWallet.create({ chainId: 1 });
 * }
 * 
 * // Use connected wallets
 * if (ethereumWallet.status === 'connected' && ethereumWallet.wallets.length > 0) {
 *   const provider = await ethereumWallet.wallets[0].getProvider();
 *   // Use provider for Ethereum transactions
 * }
 * ```
 */
export function useEmbeddedEthereumWallet(props?: UseEmbeddedEthereumWallet): EmbeddedEthereumWalletState {
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

  // Extract Ethereum wallets from embedded accounts
  const wallets: ConnectedEmbeddedEthereumWallet[] = embeddedAccounts
    .filter(account => account.chainType === ChainTypeEnum.EVM)
    .map((account, index) => ({
      address: account.address,
      implementationType: account.implementationType,
      ownerAddress: account.ownerAddress,
      walletIndex: index,
      chainType: 'ethereum' as const,
      getProvider: async () => {
        return await client.embeddedWallet.getEthereumProvider();
      },
    }));

  const create = useCallback(
    async (opts?: { chainId?: number; recoveryPassword?: string; policyId?: string }): Promise<EmbeddedAccount> => {
      console.log('Creating Ethereum wallet with options:', opts);
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
        console.log('Using chain ID for wallet creation:', chainId);

        // Create shield authentication object
        let shieldAuthentication: ShieldAuthentication | null = null;
        if (embeddedWallet) {
          const accessToken = await client.getAccessToken();
          if (!accessToken) {
            throw new Error('Access token is required for shield authentication');
          }
          console.log('Access token for shield authentication:', accessToken);

          // Get encryption session from embedded wallet configuration
          let encryptionSession: string | undefined;
          if ('getEncryptionSession' in embeddedWallet && embeddedWallet.getEncryptionSession) {
            encryptionSession = await embeddedWallet.getEncryptionSession();
            console.log('Encryption session for shield authentication:', encryptionSession);
          }

          shieldAuthentication = {
            auth: ShieldAuthType.OPENFORT,
            token: accessToken,
            ...(encryptionSession && { encryptionSession }),
          };
        }
        console.log('Shield authentication object:', shieldAuthentication);

        // Configure embedded wallet with shield authentication
        const embeddedAccount = await client.embeddedWallet.configure({
          chainId,
          shieldAuthentication: shieldAuthentication ?? undefined,
          recoveryParams: opts?.recoveryPassword ? { password: opts.recoveryPassword, recoveryMethod: RecoveryMethod.PASSWORD } : undefined
        });
        console.log('Embedded wallet configured with shield authentication');

        // Get the Ethereum provider
        const provider = await client.embeddedWallet.getEthereumProvider({
          announceProvider: false,
          ...(opts?.policyId && { policy: opts.policyId }),
        });

        // Refetch the list of wallets to ensure the state is up to date
        await fetchEmbeddedWallets();

        callbacksRef.current?.onCreateWalletSuccess?.(provider);

        return embeddedAccount;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to create Ethereum wallet');
        callbacksRef.current?.onCreateWalletError?.(errorObj);
        throw errorObj;
      }
    },
    [client, supportedChains, embeddedWallet, _internal, user]
  );

  // Check if user has any Ethereum wallet accounts
  const hasWallets = wallets.length > 0;
  console.log(`useEmbeddedWallet: ${embeddedState}`)
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
            chainType: 'ethereum',
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
          chainType: 'ethereum',
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