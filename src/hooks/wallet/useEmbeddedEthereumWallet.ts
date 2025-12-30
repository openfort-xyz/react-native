import { AccountTypeEnum, ChainTypeEnum, type EmbeddedAccount, EmbeddedState } from '@openfort/openfort-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOpenfortContext } from '../../core/context'
import { onError, onSuccess } from '../../lib/hookConsistency'
import { logger } from '../../lib/logger'
import type { BaseFlowState } from '../../types/baseFlowState'
import { OpenfortError, OpenfortErrorType } from '../../types/openfortError'
import type {
  ConnectedEmbeddedEthereumWallet,
  CreateEthereumWalletOptions,
  EmbeddedEthereumWalletState,
  OpenfortEmbeddedEthereumWalletProvider,
  SetActiveEthereumWalletOptions,
  SetActiveEthereumWalletResult,
  SetRecoveryOptions,
} from '../../types/wallet'
import { buildRecoveryParams } from './utils'

type UseEmbeddedEthereumWalletOptions = {
  chainId?: number
  onCreateSuccess?: (account: EmbeddedAccount, provider: OpenfortEmbeddedEthereumWalletProvider) => void
  onCreateError?: (error: OpenfortError) => void
  onSetActiveSuccess?: (
    wallet: ConnectedEmbeddedEthereumWallet,
    provider: OpenfortEmbeddedEthereumWalletProvider
  ) => void
  onSetActiveError?: (error: OpenfortError) => void
  onSetRecoverySuccess?: () => void
  onSetRecoveryError?: (error: OpenfortError) => void
}

type WalletFlowStatus =
  | BaseFlowState
  | {
      status: 'creating' | 'connecting' | 'reconnecting' | 'disconnected' | 'needs-recovery'
      error?: never
    }

/**
 * Hook for managing embedded Ethereum wallets.
 *
 * This hook provides comprehensive management of embedded Ethereum wallets including creation,
 * recovery, activation, and EIP-1193 provider access. Returns a discriminated union state that
 * enables type-safe wallet interactions based on connection status.
 *
 * **Wallet Types Supported:**
 * - Smart Contract Accounts (Account Abstraction)
 * - EOA (Externally Owned Accounts)
 *
 * **Recovery Methods:**
 * - Automatic recovery (via encryption session)
 * - Password-based recovery
 *
 * @param options - Configuration options including:
 *   - `chainId` - Default chain ID for wallet operations
 *   - `onCreateSuccess` - Callback when wallet is created
 *   - `onCreateError` - Callback when wallet creation fails
 *   - `onSetActiveSuccess` - Callback when wallet is activated/recovered
 *   - `onSetActiveError` - Callback when wallet activation fails
 *   - `onSetRecoverySuccess` - Callback when recovery method is updated
 *   - `onSetRecoveryError` - Callback when recovery update fails
 *
 * @returns Discriminated union state based on `status` field:
 *   - **'disconnected'**: No active wallet. Properties: `create`, `setActive`, `wallets`, `setRecovery`, `exportPrivateKey`
 *   - **'connecting'**: Activating wallet. Properties: same as disconnected + `activeWallet`
 *   - **'reconnecting'**: Reconnecting to wallet. Properties: same as connecting
 *   - **'creating'**: Creating new wallet. Properties: same as disconnected
 *   - **'needs-recovery'**: Recovery required. Properties: same as connecting
 *   - **'connected'**: Wallet ready. Properties: all + `provider` (EIP-1193 provider)
 *   - **'error'**: Operation failed. Properties: all + `error` message
 *
 * @example
 * ```tsx
 * import { useEmbeddedEthereumWallet } from '@openfort/react-native';
 * import { ActivityIndicator } from 'react-native';
 *
 * function WalletComponent() {
 *   const ethereum = useEmbeddedEthereumWallet({
 *     chainId: 137, // Polygon
 *     onCreateSuccess: (account, provider) => {
 *       console.log('Wallet created:', account.address);
 *     },
 *   });
 *
 *   // Handle loading states
 *   if (ethereum.status === 'creating' || ethereum.status === 'connecting') {
 *     return <ActivityIndicator />;
 *   }
 *
 *   // Create first wallet
 *   if (ethereum.status === 'disconnected' && ethereum.wallets.length === 0) {
 *     return <Button onPress={() => ethereum.create()} title="Create Wallet" />;
 *   }
 *
 *   // Activate existing wallet
 *   if (ethereum.status === 'disconnected' && ethereum.wallets.length > 0) {
 *     return (
 *       <Button
 *         onPress={() => ethereum.setActive({
 *           address: ethereum.wallets[0].address,
 *           recoveryPassword: 'optional-password'
 *         })}
 *         title="Connect Wallet"
 *       />
 *     );
 *   }
 *
 *   // Use connected wallet
 *   if (ethereum.status === 'connected') {
 *     const sendTransaction = async () => {
 *       const tx = await ethereum.provider.request({
 *         method: 'eth_sendTransaction',
 *         params: [{
 *           from: ethereum.activeWallet.address,
 *           to: '0x...',
 *           value: '0x0'
 *         }]
 *       });
 *       console.log('Transaction hash:', tx);
 *     };
 *
 *     return <Button onPress={sendTransaction} title="Send Transaction" />;
 *   }
 *
 *   return null;
 * }
 * ```
 */
export function useEmbeddedEthereumWallet(options: UseEmbeddedEthereumWalletOptions = {}): EmbeddedEthereumWalletState {
  const { client, supportedChains, walletConfig, embeddedState, user } = useOpenfortContext()
  const [embeddedAccounts, setEmbeddedAccounts] = useState<EmbeddedAccount[]>([])
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null)
  const [activeAccount, setActiveAccount] = useState<EmbeddedAccount | null>(null)
  const [provider, setProvider] = useState<OpenfortEmbeddedEthereumWalletProvider | null>(null)
  const recoverPromiseRef = useRef<Promise<SetActiveEthereumWalletResult> | null>(null)

  const [status, setStatus] = useState<WalletFlowStatus>({
    status: 'idle',
  })

  // Fetch Ethereum embedded accounts
  const fetchEmbeddedAccounts = useCallback(async () => {
    if (!client || embeddedState === EmbeddedState.NONE || embeddedState === EmbeddedState.UNAUTHENTICATED) {
      setEmbeddedAccounts([])
      return
    }

    try {
      const accounts = await client.embeddedWallet.list({
        limit: 100,
        chainType: ChainTypeEnum.EVM,
        accountType: walletConfig?.accountType === AccountTypeEnum.EOA ? undefined : AccountTypeEnum.SMART_ACCOUNT,
      })
      // Filter for Ethereum accounts only
      setEmbeddedAccounts(accounts)
    } catch {
      setEmbeddedAccounts([])
    }
  }, [client, embeddedState, walletConfig])

  useEffect(() => {
    fetchEmbeddedAccounts()
  }, [fetchEmbeddedAccounts])

  // Sync active wallet ID and account with client
  useEffect(() => {
    ;(async () => {
      try {
        const embeddedAccount = await client.embeddedWallet.get()
        if (embeddedAccount.chainType === ChainTypeEnum.EVM) {
          setActiveWalletId(embeddedAccount.id)
          setActiveAccount(embeddedAccount)
        } else {
          setActiveWalletId(null)
          setActiveAccount(null)
        }
      } catch {
        setActiveWalletId(null)
        setActiveAccount(null)
      }
    })()
  }, [client])

  // Get Ethereum provider
  const getEthereumProvider = useCallback(async () => {
    const resolvePolicy = () => {
      const ethereumProviderPolicyId = walletConfig?.ethereumProviderPolicyId

      if (!ethereumProviderPolicyId) return undefined

      if (typeof ethereumProviderPolicyId === 'string') {
        return ethereumProviderPolicyId
      }

      if (!options.chainId) return undefined

      const policy = ethereumProviderPolicyId[options.chainId]
      if (!policy) {
        return undefined
      }

      return policy
    }

    return await client.embeddedWallet.getEthereumProvider({ announceProvider: false, policy: resolvePolicy() })
  }, [client.embeddedWallet, walletConfig, options.chainId])

  // Initialize provider when recovering an active wallet on mount
  useEffect(() => {
    // Only initialize if we have an account but no provider
    if (!activeAccount || provider) {
      return
    }

    // Don't interfere with user-initiated actions
    if (['creating', 'connecting', 'reconnecting', 'loading'].includes(status.status)) {
      return
    }

    // Only initialize if embedded state is ready
    if (embeddedState !== EmbeddedState.READY) {
      return
    }

    ;(async () => {
      try {
        logger.info('Initializing provider for recovered Ethereum wallet session')
        setStatus({ status: 'connecting' })

        const ethProvider = await getEthereumProvider()
        setProvider(ethProvider)
        setStatus({ status: 'success' })
      } catch (e) {
        const error =
          e instanceof OpenfortError
            ? e
            : new OpenfortError(
                'Failed to initialize provider for active Ethereum wallet',
                OpenfortErrorType.WALLET_ERROR,
                { error: e }
              )
        logger.error('Ethereum provider initialization failed', error)
        setStatus({ status: 'error', error })
      }
    })()
  }, [activeAccount, provider, embeddedState, status.status, getEthereumProvider])

  // Build wallets list with deduplication logic
  const wallets: ConnectedEmbeddedEthereumWallet[] = useMemo(() => {
    // Deduplicate accounts based on account type
    const deduplicatedAccounts = embeddedAccounts.reduce((acc, account) => {
      if (walletConfig?.accountType === AccountTypeEnum.EOA) {
        // For EOAs, deduplicate by address only (EOAs work across all chains)
        if (!acc.some((a) => a.address.toLowerCase() === account.address.toLowerCase())) {
          acc.push(account)
        }
      } else {
        // For Smart Accounts, keep separate entries per chain (they're chain-specific)
        // Only deduplicate exact matches (same address AND same chainId)
        if (
          !acc.some((a) => a.address.toLowerCase() === account.address.toLowerCase() && a.chainId === account.chainId)
        ) {
          acc.push(account)
        }
      }
      return acc
    }, [] as EmbeddedAccount[])

    return deduplicatedAccounts.map((account, index) => ({
      address: account.address,
      ownerAddress: account.ownerAddress,
      implementationType: account.implementationType,
      chainType: ChainTypeEnum.EVM,
      walletIndex: index,
      getProvider: async () => await getEthereumProvider(),
    }))
  }, [embeddedAccounts, walletConfig?.accountType, getEthereumProvider])

  // Create wallet action
  const create = useCallback(
    async (createOptions?: CreateEthereumWalletOptions): Promise<EmbeddedAccount> => {
      logger.info('Creating Ethereum wallet with options', createOptions)
      try {
        setStatus({ status: 'creating' })

        // Validate chainId
        let chainId: number | undefined
        if (createOptions?.chainId) {
          if (!supportedChains || !supportedChains.some((chain) => chain.id === createOptions.chainId)) {
            throw new OpenfortError(
              `Chain ID ${createOptions.chainId} is not supported. Supported chains: ${supportedChains?.map((c) => c.id).join(', ') || 'none'}`,
              OpenfortErrorType.WALLET_ERROR
            )
          }
          chainId = createOptions.chainId
        } else if (options.chainId) {
          chainId = options.chainId
        } else if (supportedChains && supportedChains.length > 0) {
          chainId = supportedChains[0].id
        } else {
          throw new OpenfortError('No supported chains available for wallet creation', OpenfortErrorType.WALLET_ERROR)
        }

        // Build recovery params
        const recoveryParams = await buildRecoveryParams({ ...createOptions, userId: user?.id }, walletConfig)
        const accountType = createOptions?.accountType || walletConfig?.accountType || AccountTypeEnum.SMART_ACCOUNT
        // Create embedded wallet
        const embeddedAccount = await client.embeddedWallet.create({
          chainId: accountType === AccountTypeEnum.EOA ? undefined : chainId,
          accountType,
          chainType: ChainTypeEnum.EVM,
          recoveryParams,
        })
        logger.info('Embedded Ethereum wallet created')

        // Get provider
        const ethProvider = await getEthereumProvider()
        setProvider(ethProvider)

        // Refresh accounts and set as active
        await fetchEmbeddedAccounts()
        setActiveWalletId(embeddedAccount.id)
        setActiveAccount(embeddedAccount)

        setStatus({ status: 'success' })

        onSuccess({
          options: createOptions,
          data: {
            account: embeddedAccount,
            provider: ethProvider,
          },
        })

        if (createOptions?.onSuccess) {
          createOptions.onSuccess({ account: embeddedAccount, provider: ethProvider })
        }
        if (options.onCreateSuccess) {
          options.onCreateSuccess(embeddedAccount, ethProvider)
        }

        return embeddedAccount
      } catch (e) {
        const error =
          e instanceof OpenfortError
            ? e
            : new OpenfortError('Failed to create Ethereum wallet', OpenfortErrorType.WALLET_ERROR, { error: e })
        setStatus({ status: 'error', error })

        onError({
          options: createOptions,
          error,
        })

        if (createOptions?.onError) {
          createOptions.onError(error)
        }
        if (options.onCreateError) {
          options.onCreateError(error)
        }

        throw error
      }
    },
    [client, supportedChains, walletConfig, options, getEthereumProvider, fetchEmbeddedAccounts]
  )

  // Set active wallet action
  const setActive = useCallback(
    async (setActiveOptions: SetActiveEthereumWalletOptions): Promise<void> => {
      // Prevent concurrent recoveries
      if (recoverPromiseRef.current) {
        await recoverPromiseRef.current
        return
      }

      if (wallets.length === 0) {
        const error = new OpenfortError(
          'No embedded Ethereum wallets available to set as active',
          OpenfortErrorType.WALLET_ERROR
        )
        onError({
          options: setActiveOptions,
          error,
        })
        if (setActiveOptions.onError) {
          setActiveOptions.onError(error)
        }
        if (options.onSetActiveError) {
          options.onSetActiveError(error)
        }
        throw error
      }

      setStatus({ status: 'connecting' })

      recoverPromiseRef.current = (async (): Promise<SetActiveEthereumWalletResult> => {
        try {
          // Validate chainId
          let chainId: number | undefined
          if (setActiveOptions.chainId) {
            if (!supportedChains || !supportedChains.some((chain) => chain.id === setActiveOptions.chainId)) {
              throw new OpenfortError(
                `Chain ID ${setActiveOptions.chainId} is not supported. Supported chains: ${supportedChains?.map((c) => c.id).join(', ') || 'none'}`,
                OpenfortErrorType.WALLET_ERROR
              )
            }
            chainId = setActiveOptions.chainId
          } else if (options.chainId) {
            chainId = options.chainId
          } else if (supportedChains && supportedChains.length > 0) {
            chainId = supportedChains[0].id
          }

          // Find account to recover
          let embeddedAccountToRecover: EmbeddedAccount | undefined

          if (walletConfig?.accountType === AccountTypeEnum.EOA) {
            // For EOAs, match only by address (EOAs work across all chains)
            embeddedAccountToRecover = embeddedAccounts.find(
              (account) => account.address.toLowerCase() === setActiveOptions.address.toLowerCase()
            )
          } else {
            // For Smart Accounts, match by both address and chainId (Smart Accounts are chain-specific)
            embeddedAccountToRecover = embeddedAccounts.find(
              (account) =>
                account.chainId === chainId && account.address.toLowerCase() === setActiveOptions.address.toLowerCase()
            )
          }

          if (!embeddedAccountToRecover) {
            const errorMsg =
              walletConfig?.accountType === AccountTypeEnum.EOA
                ? `No embedded EOA account found for address ${setActiveOptions.address}`
                : `No embedded smart account found for address ${setActiveOptions.address} on chain ID ${chainId}`
            throw new OpenfortError(errorMsg, OpenfortErrorType.WALLET_ERROR)
          }

          // Build recovery params
          const recoveryParams = await buildRecoveryParams({ ...setActiveOptions, userId: user?.id }, walletConfig)

          // Recover the embedded wallet
          const embeddedAccount = await client.embeddedWallet.recover({
            account: embeddedAccountToRecover.id,
            recoveryParams,
          })

          // Get provider
          const ethProvider = await getEthereumProvider()
          setProvider(ethProvider)

          // Find the wallet index in the deduplicated accounts list
          const walletIndex = embeddedAccounts.findIndex(
            (acc) =>
              acc.address.toLowerCase() === embeddedAccount.address.toLowerCase() &&
              acc.chainId === embeddedAccount.chainId
          )

          const wallet: ConnectedEmbeddedEthereumWallet = {
            address: embeddedAccount.address,
            ownerAddress: embeddedAccount.ownerAddress,
            implementationType: embeddedAccount.implementationType,
            chainType: ChainTypeEnum.EVM,
            walletIndex: walletIndex >= 0 ? walletIndex : 0,
            getProvider: async () => ethProvider,
          }

          recoverPromiseRef.current = null
          setStatus({ status: 'success' })
          setActiveWalletId(embeddedAccount.id)
          setActiveAccount(embeddedAccount)

          onSuccess({
            options: setActiveOptions,
            data: {
              wallet,
              provider: ethProvider,
            },
          })

          if (setActiveOptions.onSuccess) {
            setActiveOptions.onSuccess({ wallet, provider: ethProvider })
          }
          if (options.onSetActiveSuccess) {
            options.onSetActiveSuccess(wallet, ethProvider)
          }

          return { wallet, provider: ethProvider }
        } catch (e) {
          recoverPromiseRef.current = null
          const error =
            e instanceof OpenfortError
              ? e
              : new OpenfortError('Failed to set active Ethereum wallet', OpenfortErrorType.WALLET_ERROR)
          setStatus({ status: 'error', error })

          onError({
            options: setActiveOptions,
            error,
          })

          if (setActiveOptions.onError) {
            setActiveOptions.onError(error)
          }
          if (options.onSetActiveError) {
            options.onSetActiveError(error)
          }

          throw error
        }
      })()

      await recoverPromiseRef.current
    },
    [client, supportedChains, walletConfig, embeddedAccounts, options, wallets.length, getEthereumProvider]
  )

  // Set recovery method action
  const setRecovery = useCallback(
    async (params: SetRecoveryOptions): Promise<void> => {
      try {
        setStatus({ status: 'loading' })

        await client.embeddedWallet.setRecoveryMethod(params.previousRecovery, params.newRecovery)

        setStatus({ status: 'success' })

        onSuccess({
          options: params,
          data: {},
        })

        if (params.onSuccess) {
          params.onSuccess({})
        }
        if (options.onSetRecoverySuccess) {
          options.onSetRecoverySuccess()
        }
      } catch (e) {
        const error = new OpenfortError('Failed to set wallet recovery', OpenfortErrorType.WALLET_ERROR, {
          error: e instanceof Error ? e : new Error('Unknown error'),
        })
        setStatus({ status: 'error', error })

        onError({
          options: params,
          error,
        })

        if (params.onError) {
          params.onError(error)
        }
        if (options.onSetRecoveryError) {
          options.onSetRecoveryError(error)
        }

        throw error
      }
    },
    [client, options]
  )

  // Build active wallet from embeddedWallet.get()
  const activeWallet = useMemo((): ConnectedEmbeddedEthereumWallet | null => {
    if (!activeWalletId || !activeAccount) return null

    // Find the wallet index in the accounts list
    const accountIndex = embeddedAccounts.findIndex((acc) => acc.id === activeWalletId)

    return {
      address: activeAccount.address,
      ownerAddress: activeAccount.ownerAddress,
      implementationType: activeAccount.implementationType,
      chainType: ChainTypeEnum.EVM,
      walletIndex: accountIndex >= 0 ? accountIndex : 0,
      getProvider: async () => await getEthereumProvider(),
    }
  }, [activeWalletId, activeAccount, embeddedAccounts, getEthereumProvider])

  // Build discriminated union state
  const state: EmbeddedEthereumWalletState = useMemo(() => {
    const baseActions = {
      create,
      wallets,
      setActive,
      setRecovery,
      exportPrivateKey: client.embeddedWallet.exportPrivateKey,
    }

    // Priority 1: Explicit action states (user-initiated operations)
    if (status.status === 'creating') {
      return { ...baseActions, status: 'creating', activeWallet: null }
    }

    if (status.status === 'connecting' || status.status === 'reconnecting' || status.status === 'loading') {
      return { ...baseActions, status: 'connecting', activeWallet: activeWallet! }
    }

    if (status.status === 'error') {
      return { ...baseActions, status: 'error', activeWallet, error: status.error?.message || 'Unknown error' }
    }

    // Priority 2: Check authentication state from context
    if (embeddedState !== EmbeddedState.READY && embeddedState !== EmbeddedState.CREATING_ACCOUNT) {
      // Not authenticated or no embedded wallet capability
      return { ...baseActions, status: 'disconnected', activeWallet: null }
    }

    // Priority 3: Data-driven connection state
    if (activeWallet && provider) {
      // Fully connected - have both wallet and provider
      return { ...baseActions, status: 'connected', activeWallet, provider }
    }

    if (activeAccount && !provider) {
      // Have wallet but provider not initialized yet (mount recovery in progress)
      return { ...baseActions, status: 'connecting', activeWallet: activeWallet! }
    }

    // Default: disconnected (authenticated but no wallet selected)
    return { ...baseActions, status: 'disconnected', activeWallet: null }
  }, [
    status,
    activeWallet,
    activeAccount,
    provider,
    wallets,
    embeddedState,
    create,
    setActive,
    setRecovery,
    client.embeddedWallet,
  ])

  return state
}
