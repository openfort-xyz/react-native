import { AccountTypeEnum, ChainTypeEnum, EmbeddedState, Provider, RecoveryMethod, RecoveryParams, type EmbeddedAccount } from '@openfort/openfort-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOpenfortContext } from '../../core/context';
import { onError, onSuccess } from '../../lib/hookConsistency';
import { BaseFlowState } from '../../types/baseFlowState';
import { Hex } from '../../types/hex';
import { OpenfortHookOptions } from '../../types/hookOption';
import { OpenfortError, OpenfortErrorType } from '../../types/openfortError';
import { UserWallet } from '../../types/wallet';
import { logger } from '../../lib/logger';


type SetActiveWalletResult = {
  error?: OpenfortError,
  wallet?: UserWallet,
  provider?: Provider,
}

type SetActiveWalletOptions = {
  address?: Hex | undefined;
  chainId?: number;
  recoveryPassword?: string;
} & OpenfortHookOptions<SetActiveWalletResult>

type CreateWalletResult = SetActiveWalletResult

type CreateWalletOptions = {
  chainType?: ChainTypeEnum;
  chainId?: number;
  recoveryPassword?: string;
  accountType?: AccountTypeEnum;
} & OpenfortHookOptions<CreateWalletResult>

type RecoverEmbeddedWalletResult = SetActiveWalletResult

type SetRecoveryOptions = {
  previousRecovery: RecoveryParams,
  newRecovery: RecoveryParams,
} & OpenfortHookOptions<CreateWalletResult>

type WalletOptions = {
  chainId?: number;
} & OpenfortHookOptions<SetActiveWalletResult | CreateWalletResult>;

type WalletFlowStatus = BaseFlowState | {
  status: "creating" | "connecting" | "disconnected";
  address?: Hex;
  error?: never;
}

const mapWalletStatus = (status: WalletFlowStatus) => {
  return {
    error: status.error,
    isError: status.status === 'error',
    isSuccess: status.status === 'success',
    isCreating: status.status === 'creating',
    isConnecting: status.status === 'connecting',
  }
}
/**
 * Hook for interacting with embedded Ethereum wallets.
 *
 * This hook manages embedded Ethereum wallets based on the user's state from the provider. Wallet state is determined by
 * polling in the provider, not by local state management.
 *
 * @param hookOptions - Optional configuration with callback functions.
 * @returns Current embedded Ethereum wallet state with actions.
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
export function useWallets(hookOptions: WalletOptions = {}) {
  const { client, user, supportedChains, walletConfig, embeddedState, _internal } = useOpenfortContext();
  const [embeddedAccounts, setEmbeddedAccounts] = useState<EmbeddedAccount[]>([]);
  const recoverPromiseRef = useRef<Promise<SetActiveWalletResult> | null>(null);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null); // OPENFORT-JS Should provide this

  const [status, setStatus] = useState<WalletFlowStatus>({
    status: "idle",
  })

  const activeWallet = useMemo((): UserWallet | null => {
    if (!activeWalletId || !embeddedAccounts) return null;
    const account = embeddedAccounts.find(acc => acc.id === activeWalletId);
    if (!account) return null;
    return {
      address: account.address as Hex,
      implementationType: account.implementationType,
      ownerAddress: account.ownerAddress,
      chainType: account.chainType,
      isActive: true,
      isConnecting: false,
      getProvider: async () => {
        return await getEthereumProvider();
      },
    };
  }, [activeWalletId, embeddedAccounts, client.embeddedWallet]);

  const setActiveWallet = useCallback(
    async (options?: SetActiveWalletOptions): Promise<SetActiveWalletResult> => {
      // If there's already a recovery in progress, return the existing promise
      if (recoverPromiseRef.current) {
        return recoverPromiseRef.current;
      }
      if (wallets.length === 0) {
        return onError({
          hookOptions,
          options,
          error: new OpenfortError('No embedded wallets available to set as active', OpenfortErrorType.WALLET_ERROR),
        });
      }

      setStatus({
        status: 'connecting',
        address: options?.address,
      });

      // Create and store the recovery promise
      recoverPromiseRef.current = (async (): Promise<SetActiveWalletResult> => {
        try {
          // Validate chainId if provided
          let chainId: number | undefined;
          if (options?.chainId) {
            if (!supportedChains || !supportedChains.some(chain => chain.id === options.chainId)) {
              throw new OpenfortError(
                `Chain ID ${options.chainId} is not supported. Supported chains: ${supportedChains?.map(c => c.id).join(', ') || 'none'}`,
                OpenfortErrorType.WALLET_ERROR
              );
            }
            chainId = options.chainId;
          } else if (supportedChains && supportedChains.length > 0) {
            // Use the first supported chain as default
            chainId = supportedChains[0].id;
          }

          const address = options?.address || wallets[0]?.address;

          const embeddedAccountToRecover = embeddedAccounts.find(account => account.chainId === chainId && account.address === address);

          let embeddedAccount: EmbeddedAccount | undefined;
          if (!embeddedAccountToRecover) {
            // Different chain maybe?
            // if (embeddedAccounts.some(account => account.address === address)) {
            // create wallet with new chain
            // embeddedAccount = await client.embeddedWallet.create({
            //   chainId: chainId!,
            //   accountType: AccountTypeEnum.SMART_ACCOUNT,
            //   chainType: ChainTypeEnum.EVM,
            //   shieldAuthentication: shieldAuthentication ?? undefined,
            //   recoveryParams: options?.recoveryPassword ? { password: options.recoveryPassword, recoveryMethod: RecoveryMethod.PASSWORD } : undefined
            // });
            // } else {
            throw new OpenfortError(`No embedded account found for address ${address} on chain ID ${chainId}`, OpenfortErrorType.WALLET_ERROR);
            // }
          } else {
            let recoveryParams: RecoveryParams;;
            if (options?.recoveryPassword) {
              recoveryParams = {
                recoveryMethod: RecoveryMethod.PASSWORD,
                password: options.recoveryPassword,
              }
            } else {
              if (!walletConfig?.getEncryptionSession) {
                throw new OpenfortError('Encryption session (walletConfig.getEncryptionSession) is required for automatic recovery', OpenfortErrorType.WALLET_ERROR);
              }

              recoveryParams = {
                recoveryMethod: RecoveryMethod.AUTOMATIC,
                encryptionSession: await walletConfig.getEncryptionSession()
              };
            }

            // Recover the embedded wallet with shield authentication
            embeddedAccount = await client.embeddedWallet.recover({
              account: embeddedAccountToRecover.id,
              recoveryParams,
            });
          }
          const wallet: UserWallet = {
            address: embeddedAccount.address as Hex,
            implementationType: embeddedAccount.implementationType,
            ownerAddress: embeddedAccount.ownerAddress,
            chainType: embeddedAccount.chainType,
            isActive: true,
            isConnecting: false,
            getProvider: async () => {
              return await getEthereumProvider();
            },
          }

          recoverPromiseRef.current = null;
          setStatus({
            status: 'success',
          });
          setActiveWalletId(embeddedAccount.id);
          return onSuccess({
            options,
            hookOptions,
            data: {
              wallet,
            }
          });
        } catch (e) {
          recoverPromiseRef.current = null;
          const error = e instanceof OpenfortError ? e : new OpenfortError('Failed to recover embedded wallet', OpenfortErrorType.WALLET_ERROR);
          setStatus({
            status: 'error',
            error,
          });
          return onError({
            options,
            hookOptions,
            error,
          });
        }
      })();

      return recoverPromiseRef.current;
    },
    [client, supportedChains, walletConfig, _internal, embeddedAccounts, hookOptions]
  );

  // Fetch embedded wallets using embeddedWallet.list()
  const fetchEmbeddedWallets = useCallback(async () => {
    if (!client || embeddedState === EmbeddedState.NONE || embeddedState === EmbeddedState.UNAUTHENTICATED) {
      setEmbeddedAccounts([]);
      return;
    }

    try {
      const accounts = await client.embeddedWallet.list();
      setEmbeddedAccounts(accounts);
    } catch {
      setEmbeddedAccounts([]);
    }
  }, [client, embeddedState, user]);

  useEffect(() => {
    fetchEmbeddedWallets();
  }, [fetchEmbeddedWallets]);

  const getEthereumProvider = useCallback(async () => {
    const resolvePolicy = () => {
      const ethereumProviderPolicyId = walletConfig?.ethereumProviderPolicyId;

      if (!ethereumProviderPolicyId) return undefined;

      if (typeof ethereumProviderPolicyId === "string") {
        return ethereumProviderPolicyId;
      }

      if (!hookOptions.chainId) return undefined;

      const policy = ethereumProviderPolicyId[hookOptions.chainId];
      if (!policy) {
        return undefined;
      }

      return policy;
    };

    return await client.embeddedWallet.getEthereumProvider({ announceProvider: false, policy: resolvePolicy() });
  }, [client.embeddedWallet]);

  useEffect(() => {
    (async () => {
      try {
        const embeddedAccount = await client.embeddedWallet.get();
        setActiveWalletId(embeddedAccount.id);
      } catch {
        setActiveWalletId(null);
      }
    })();
  }, [setActiveWalletId, client])

  // Extract Ethereum wallets from embedded accounts
  const wallets: UserWallet[] = useMemo(() => (
    embeddedAccounts
      .reduce((acc, account) => {
        if (!acc.some(a => a.address === account.address)) {
          acc.push(account);
        }
        return acc;
      }, [] as EmbeddedAccount[])
      .map((account) => ({
        address: account.address as Hex,
        implementationType: account.implementationType,
        ownerAddress: account.ownerAddress,
        chainType: account.chainType,
        isActive: activeWalletId === account.id,
        isConnecting: status.status === "connecting" && status.address === account.address,
        getProvider: async () => {
          return await getEthereumProvider();
        },
      }))
  ), [embeddedAccounts, activeWalletId, status.status === "connecting", client.embeddedWallet]);

  const create = useCallback(
    async (options?: CreateWalletOptions): Promise<CreateWalletResult> => {
      logger.info('Creating Ethereum wallet with options', options);
      try {
        setStatus({
          status: 'creating',
        });

        // Validate chainId if provided
        let chainId: number;
        if (options?.chainId) {
          if (!supportedChains || !supportedChains.some(chain => chain.id === options.chainId)) {
            throw new OpenfortError(
              `Chain ID ${options.chainId} is not supported. Supported chains: ${supportedChains?.map(c => c.id).join(', ') || 'none'}`,
              OpenfortErrorType.WALLET_ERROR
            );
          }
          chainId = options.chainId!;
        } else if (supportedChains && supportedChains.length > 0) {
          // Use the first supported chain as default
          chainId = supportedChains[0].id;
        } else {
          throw new OpenfortError('No supported chains available for wallet creation', OpenfortErrorType.WALLET_ERROR);
        }
        logger.info('Using chain ID for wallet creation', chainId);

        let recoveryParams: RecoveryParams;;
        if (options?.recoveryPassword) {
          recoveryParams = {
            recoveryMethod: RecoveryMethod.PASSWORD,
            password: options.recoveryPassword,
          }
        } else {
          if (!walletConfig?.getEncryptionSession) {
            throw new OpenfortError('Encryption session (walletConfig.getEncryptionSession) is required for automatic recovery', OpenfortErrorType.WALLET_ERROR);
          }

          recoveryParams = {
            recoveryMethod: RecoveryMethod.AUTOMATIC,
            encryptionSession: await walletConfig.getEncryptionSession()
          };
        }

        // Configure embedded wallet with shield authentication
        const embeddedAccount = await client.embeddedWallet.create({
          chainId,
          accountType: options?.accountType || walletConfig?.accountType || AccountTypeEnum.SMART_ACCOUNT,
          chainType: options?.chainType || ChainTypeEnum.EVM,
          recoveryParams,
        });
        logger.info('Embedded wallet configured with shield authentication');

        // Get the Ethereum provider
        const provider = await getEthereumProvider();

        // Refetch the list of wallets to ensure the state is up to date
        await fetchEmbeddedWallets();
        setActiveWalletId(embeddedAccount.id);

        setStatus({
          status: 'success',
        });

        return onSuccess({
          hookOptions,
          options,
          data: {
            provider,
            wallet: {
              address: embeddedAccount.address as Hex,
              implementationType: embeddedAccount.implementationType,
              ownerAddress: embeddedAccount.ownerAddress,
              chainType: embeddedAccount.chainType,
              isActive: true,
              isConnecting: false,
              getProvider: async () => {
                return await client.embeddedWallet.getEthereumProvider();
              },
            }
          }
        })
      } catch (e) {
        const error = e instanceof OpenfortError ? e : new OpenfortError('Failed to create Ethereum wallet', OpenfortErrorType.WALLET_ERROR, { error: e });
        setStatus({
          status: 'error',
          error,
        });
        return onError({
          hookOptions,
          options,
          error
        })
      }
    },
    [client, supportedChains, walletConfig, _internal, user]
  );

  const setRecovery = useCallback(
    async (params: SetRecoveryOptions): Promise<RecoverEmbeddedWalletResult> => {
      try {
        setStatus({
          status: 'loading',
        });

        // Set embedded wallet recovery method
        await client.embeddedWallet.setRecoveryMethod(params.previousRecovery, params.newRecovery);

        // Get the updated embedded account
        const embeddedAccount = await client.embeddedWallet.get();

        setStatus({ status: 'success' });
        return onSuccess({
          hookOptions,
          options: params,
          data: {
            wallet: {
              address: embeddedAccount.address as Hex,
              implementationType: embeddedAccount.implementationType,
              ownerAddress: embeddedAccount.ownerAddress,
              chainType: embeddedAccount.chainType,
              isActive: true,
              isConnecting: false,
              getProvider: async () => {
                return await getEthereumProvider();
              }
            }
          }
        });
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to set wallet recovery');
        return onError({
          hookOptions,
          options: params,
          error: new OpenfortError('Failed to set wallet recovery', OpenfortErrorType.WALLET_ERROR, { error: errorObj }),
        });
      }
    },
    [client, setStatus, hookOptions]
  );

  return {
    wallets,
    activeWallet,
    setRecovery,
    setActiveWallet,
    createWallet: create,
    ...mapWalletStatus(status),
    exportPrivateKey: client.embeddedWallet.exportPrivateKey,
  }
}