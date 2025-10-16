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
 * Hook for interacting with embedded wallets
 *
 * This hook manages embedded wallets based on the user's state from the provider. Wallet state is determined by
 * polling in the provider, not by local state management. It provides wallet creation, recovery, and management capabilities.
 *
 * @param hookOptions - Optional configuration with callback functions and chain ID settings
 * @returns Current embedded wallet state with actions and wallet collection
 *
 * @example
 * ```tsx
 * const { wallets, activeWallet, createWallet, setActiveWallet, isCreating } = useWallets({
 *   onSuccess: ({ wallet }) => console.log('Wallet operation successful:', wallet?.address),
 *   onError: ({ error }) => console.error('Wallet operation failed:', error?.message),
 *   chainId: 1, // Ethereum mainnet
 * });
 *
 * // Create a new wallet if none exist
 * if (wallets.length === 0 && !isCreating) {
 *   await createWallet({ chainId: 1 });
 * }
 *
 * // Use existing wallets
 * if (wallets.length > 0 && !activeWallet) {
 *   await setActiveWallet({ address: wallets[0].address });
 * }
 *
 * // Access active wallet
 * if (activeWallet) {
 *   const provider = await activeWallet.getProvider();
 *   // Use provider for transactions
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

  const resolveEncryptionSession = useCallback(async (): Promise<string> => {
    if (!walletConfig) {
      throw new OpenfortError('Encryption session configuration is required', OpenfortErrorType.WALLET_ERROR);
    }

    if (walletConfig.getEncryptionSession) {
      return await walletConfig.getEncryptionSession();
    }

    if (walletConfig.createEncryptedSessionEndpoint) {
      try {
        const response = await fetch(walletConfig.createEncryptedSessionEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new OpenfortError('Failed to create encryption session', OpenfortErrorType.WALLET_ERROR, { status: response.status });
        }

        const body = await response.json() as { session?: string };
        if (!body?.session || typeof body.session !== 'string') {
          throw new OpenfortError('Encryption session response is missing the `session` property', OpenfortErrorType.WALLET_ERROR);
        }

        return body.session;
      } catch (error) {
        if (error instanceof OpenfortError) {
          throw error;
        }
        throw new OpenfortError('Failed to create encryption session', OpenfortErrorType.WALLET_ERROR, { error });
      }
    }

    throw new OpenfortError('Encryption session configuration is required', OpenfortErrorType.WALLET_ERROR);
  }, [walletConfig]);

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

          // Find account to recover based on whether we're using EOA or Smart Account
          let embeddedAccountToRecover: EmbeddedAccount | undefined;

          if (walletConfig?.accountType === AccountTypeEnum.EOA) {
            // For EOAs, match only by address (EOAs work across all chains)
            embeddedAccountToRecover = embeddedAccounts.find(account =>
              account.address.toLowerCase() === address?.toLowerCase()
            );
          } else {
            // For Smart Accounts, match by both address and chainId (Smart Accounts are chain-specific)
            embeddedAccountToRecover = embeddedAccounts.find(account =>
              account.chainId === chainId && account.address.toLowerCase() === address?.toLowerCase()
            );
          }

          let embeddedAccount: EmbeddedAccount | undefined;
          if (!embeddedAccountToRecover) {
            const errorMsg = walletConfig?.accountType === AccountTypeEnum.EOA
              ? `No embedded EOA account found for address ${address}`
              : `No embedded account found for address ${address} on chain ID ${chainId}`;
            throw new OpenfortError(errorMsg, OpenfortErrorType.WALLET_ERROR);
          } else {
            let recoveryParams: RecoveryParams;;
            if (options?.recoveryPassword) {
              recoveryParams = {
                recoveryMethod: RecoveryMethod.PASSWORD,
                password: options.recoveryPassword,
              }
            } else {
              recoveryParams = {
                recoveryMethod: RecoveryMethod.AUTOMATIC,
                encryptionSession: await resolveEncryptionSession()
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
    [client, supportedChains, resolveEncryptionSession, _internal, embeddedAccounts, hookOptions]
  );

  // Fetch embedded wallets using embeddedWallet.list()
  const fetchEmbeddedWallets = useCallback(async () => {
    if (!client || embeddedState === EmbeddedState.NONE || embeddedState === EmbeddedState.UNAUTHENTICATED) {
      setEmbeddedAccounts([]);
      return;
    }

    try {
      const accounts = await client.embeddedWallet.list({
        limit: 100,
        // If its EOA we want all accounts, otherwise we want only smart accounts
        accountType: walletConfig?.accountType === AccountTypeEnum.EOA ?
          undefined : AccountTypeEnum.SMART_ACCOUNT
      });
      setEmbeddedAccounts(accounts);
    } catch {
      setEmbeddedAccounts([]);
    }
  }, [client, embeddedState, user, walletConfig]);

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
  const wallets: UserWallet[] = useMemo(() => {
    // Deduplicate accounts based on account type
    const deduplicatedAccounts = embeddedAccounts.reduce((acc, account) => {
      if (walletConfig?.accountType === AccountTypeEnum.EOA) {
        // For EOAs, deduplicate by address only (EOAs work across all chains)
        if (!acc.some(a => a.address.toLowerCase() === account.address.toLowerCase())) {
          acc.push(account);
        }
      } else {
        // For Smart Accounts, keep separate entries per chain (they're chain-specific)
        // Only deduplicate exact matches (same address AND same chainId)
        if (!acc.some(a => a.address.toLowerCase() === account.address.toLowerCase() && a.chainId === account.chainId)) {
          acc.push(account);
        }
      }
      return acc;
    }, [] as EmbeddedAccount[]);

    return deduplicatedAccounts.map((account) => ({
      address: account.address as Hex,
      implementationType: account.implementationType,
      ownerAddress: account.ownerAddress,
      chainType: account.chainType,
      isActive: activeWalletId === account.id,
      isConnecting: status.status === "connecting" && status.address === account.address,
      getProvider: async () => {
        return await getEthereumProvider();
      },
    }));
  }, [embeddedAccounts, activeWalletId, status.status, walletConfig?.accountType, client.embeddedWallet]);

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
          recoveryParams = {
            recoveryMethod: RecoveryMethod.AUTOMATIC,
            encryptionSession: await resolveEncryptionSession()
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
    [client, supportedChains, walletConfig, resolveEncryptionSession, _internal, user]
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
