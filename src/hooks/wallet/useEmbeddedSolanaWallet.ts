import { AccountTypeEnum, ChainTypeEnum, type EmbeddedAccount, EmbeddedState } from '@openfort/openfort-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOpenfortContext } from '../../core/context'
import { onError, onSuccess } from '../../lib/hookConsistency'
import { logger } from '../../lib/logger'
import type { BaseFlowState } from '../../types/baseFlowState'
import type { OpenfortHookOptions } from '../../types/hookOption'
import { OpenfortError, OpenfortErrorType } from '../../types/openfortError'
import type {
  ConnectedEmbeddedSolanaWallet,
  CreateSolanaEmbeddedWalletOpts,
  EmbeddedSolanaWalletState,
  OpenfortEmbeddedSolanaWalletProvider,
} from '../../types/wallet'
import { OpenfortSolanaProvider } from './solanaProvider'
import { buildRecoveryParams } from './utils'

type CreateSolanaWalletResult = {
  error?: OpenfortError
  account?: EmbeddedAccount
  provider?: OpenfortEmbeddedSolanaWalletProvider
}

type CreateSolanaWalletOptions = CreateSolanaEmbeddedWalletOpts & OpenfortHookOptions<CreateSolanaWalletResult>

type SetActiveSolanaWalletResult = {
  error?: OpenfortError
  wallet?: ConnectedEmbeddedSolanaWallet
  provider?: OpenfortEmbeddedSolanaWalletProvider
}

type SetActiveSolanaWalletOptions = {
  address: string
  recoveryPassword?: string
} & OpenfortHookOptions<SetActiveSolanaWalletResult>

type UseEmbeddedSolanaWalletOptions = {
  onCreateSuccess?: (account: EmbeddedAccount, provider: OpenfortEmbeddedSolanaWalletProvider) => void
  onCreateError?: (error: OpenfortError) => void
  onSetActiveSuccess?: (wallet: ConnectedEmbeddedSolanaWallet, provider: OpenfortEmbeddedSolanaWalletProvider) => void
  onSetActiveError?: (error: OpenfortError) => void
}

type WalletFlowStatus =
  | BaseFlowState
  | {
      status: 'creating' | 'connecting' | 'reconnecting' | 'disconnected' | 'needs-recovery'
      error?: never
    }

/**
 * Hook for managing embedded Solana wallets.
 *
 * This hook provides comprehensive Solana wallet management including creation, activation,
 * and recovery. It returns a discriminated union state that enables type-safe wallet interactions.
 *
 * @param options - Configuration with callback functions
 * @returns Discriminated union state object. The `status` field determines available properties.
 * Possible states: 'disconnected', 'connecting', 'reconnecting', 'creating', 'needs-recovery',
 * 'connected', 'error'. When connected, includes `provider` and `activeWallet`. All states include
 * `create`, `setActive`, and `wallets` methods/properties.
 *
 * @example
 * ```tsx
 * import { useEmbeddedSolanaWallet, isConnected, isLoading } from '@openfort/react-native';
 *
 * const solana = useEmbeddedSolanaWallet({
 *   onCreateSuccess: (account, provider) => console.log('Wallet created:', account.address),
 * });
 *
 * if (isLoading(solana)) {
 *   return <ActivityIndicator />;
 * }
 *
 * if (isConnected(solana)) {
 *   // TypeScript knows provider and activeWallet are available
 *   const signed = await solana.provider.signTransaction(transaction);
 *   const publicKey = solana.provider.publicKey;
 * }
 *
 * // Create wallet if none exist
 * if (solana.status === 'disconnected' && solana.wallets.length === 0) {
 *   await solana.create({ recoveryMethod: 'automatic' });
 * }
 * ```
 */
export function useEmbeddedSolanaWallet(options: UseEmbeddedSolanaWalletOptions = {}): EmbeddedSolanaWalletState {
  const { client, walletConfig, embeddedState } = useOpenfortContext()
  const [embeddedAccounts, setEmbeddedAccounts] = useState<EmbeddedAccount[]>([])
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null)
  const [activeAccount, setActiveAccount] = useState<EmbeddedAccount | null>(null)
  const [provider, setProvider] = useState<OpenfortEmbeddedSolanaWalletProvider | null>(null)
  const recoverPromiseRef = useRef<Promise<SetActiveSolanaWalletResult> | null>(null)

  const [status, setStatus] = useState<WalletFlowStatus>({
    status: 'idle',
  })

  // Fetch Solana embedded accounts
  const fetchEmbeddedAccounts = useCallback(async () => {
    if (!client || embeddedState === EmbeddedState.NONE || embeddedState === EmbeddedState.UNAUTHENTICATED) {
      setEmbeddedAccounts([])
      return
    }

    try {
      const accounts = await client.embeddedWallet.list({
        chainType: ChainTypeEnum.SVM,
        accountType: AccountTypeEnum.EOA,
        limit: 100,
      })
      setEmbeddedAccounts(accounts)
    } catch {
      setEmbeddedAccounts([])
    }
  }, [client, embeddedState])

  useEffect(() => {
    fetchEmbeddedAccounts()
  }, [fetchEmbeddedAccounts])

  // Sync active wallet ID and account with client
  useEffect(() => {
    ;(async () => {
      try {
        const embeddedAccount = await client.embeddedWallet.get()
        // here we check in case the current account is not SVM
        if (embeddedAccount.chainType === ChainTypeEnum.SVM) {
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

  // Get Solana provider
  const getSolanaProvider = useCallback(
    async (account: EmbeddedAccount): Promise<OpenfortEmbeddedSolanaWalletProvider> => {
      // Helper function to sign a single transaction
      const signSingleTransaction = async (transaction: any) => {
        // Extract the message bytes from the transaction
        // For @solana/kit compiledTransaction, the messageBytes property contains what needs to be signed
        let messageBytes: Uint8Array

        if (transaction.messageBytes) {
          // @solana/kit compiled transaction
          messageBytes = transaction.messageBytes
        } else if (transaction.serializeMessage) {
          // @solana/web3.js Transaction
          messageBytes = transaction.serializeMessage()
        } else if (transaction instanceof Uint8Array) {
          // Raw bytes
          messageBytes = transaction
        } else {
          throw new OpenfortError(
            'Unsupported transaction format. Expected @solana/kit compiled transaction, @solana/web3.js Transaction, or Uint8Array',
            OpenfortErrorType.WALLET_ERROR
          )
        }

        // Convert Uint8Array to Buffer JSON format for React Native WebView serialization
        // This is necessary because React Native's postMessage only accepts strings,
        // and Uint8Array serializes incorrectly as {0:1, 1:2, ...} instead of {type:"Buffer", data:[...]}
        const bufferFormatMessage = {
          type: 'Buffer',
          data: Array.from(messageBytes),
        }

        // Sign the message bytes (hashMessage: false for Solana - Ed25519 signs raw bytes)
        // Note: We cast to any because the iframe will deserialize the Buffer format correctly,
        // but TypeScript doesn't know about this serialization detail
        const signatureBase58 = await client.embeddedWallet.signMessage(bufferFormatMessage as any, {
          hashMessage: false,
        })

        // Return the signature in the expected format
        // Different libraries expect different return formats, so we return a flexible object
        return {
          signature: signatureBase58,
          publicKey: account.address,
        }
      }

      const provider = new OpenfortSolanaProvider({
        account,
        signTransaction: signSingleTransaction,
        signAllTransactions: async (transactions: any[]): Promise<any[]> => {
          // Sign each transaction sequentially
          const signedTransactions: any[] = []
          for (const transaction of transactions) {
            const signed = await signSingleTransaction(transaction)
            signedTransactions.push(signed)
          }
          return signedTransactions
        },
        signMessage: async (message: string) => {
          // Sign message using openfort-js (with hashMessage: false for Solana)
          const result = await client.embeddedWallet.signMessage(message, { hashMessage: false })
          return result
        },
      })

      return provider
    },
    [client.embeddedWallet]
  )

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
        logger.info('Initializing provider for recovered Solana wallet session')
        setStatus({ status: 'connecting' })

        const solProvider = await getSolanaProvider(activeAccount)
        setProvider(solProvider)
        setStatus({ status: 'success' })
      } catch (e) {
        const error =
          e instanceof OpenfortError
            ? e
            : new OpenfortError(
                'Failed to initialize provider for active Solana wallet',
                OpenfortErrorType.WALLET_ERROR,
                { error: e }
              )
        logger.error('Solana provider initialization failed', error)
        setStatus({ status: 'error', error })
      }
    })()
  }, [activeAccount, provider, embeddedState, status.status, getSolanaProvider])

  // Build wallets list (simple deduplication by address)
  const wallets: ConnectedEmbeddedSolanaWallet[] = useMemo(() => {
    return embeddedAccounts.map((account, index) => ({
      address: account.address,
      chainType: ChainTypeEnum.SVM,
      walletIndex: index,
      getProvider: async () => await getSolanaProvider(account),
    }))
  }, [embeddedAccounts, getSolanaProvider])

  // Create wallet action
  const create = useCallback(
    async (createOptions?: CreateSolanaWalletOptions): Promise<EmbeddedAccount> => {
      logger.info('Creating Solana wallet with options', createOptions)
      try {
        setStatus({ status: 'creating' })

        // Build recovery params (only use recoveryPassword, ignore createAdditional)
        const recoveryParams = await buildRecoveryParams(
          createOptions?.recoveryPassword ? { recoveryPassword: createOptions.recoveryPassword } : undefined,
          walletConfig
        )

        // Create embedded wallet
        const embeddedAccount = await client.embeddedWallet.create({
          chainType: ChainTypeEnum.SVM,
          recoveryParams,
          accountType: AccountTypeEnum.EOA, // Solana wallets are EOA
        })
        logger.info('Embedded Solana wallet created')

        // Get provider
        const solProvider = await getSolanaProvider(embeddedAccount)
        setProvider(solProvider)

        // Refresh accounts and set as active
        await fetchEmbeddedAccounts()
        setActiveWalletId(embeddedAccount.id)
        setActiveAccount(embeddedAccount)

        setStatus({ status: 'success' })

        onSuccess({
          options: createOptions,
          data: {
            account: embeddedAccount,
            provider: solProvider,
          },
        })

        if (createOptions?.onSuccess) {
          createOptions.onSuccess({ account: embeddedAccount, provider: solProvider })
        }
        if (options.onCreateSuccess) {
          options.onCreateSuccess(embeddedAccount, solProvider)
        }

        return embeddedAccount
      } catch (e) {
        const error =
          e instanceof OpenfortError
            ? e
            : new OpenfortError('Failed to create Solana wallet', OpenfortErrorType.WALLET_ERROR, { error: e })
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
    [client, walletConfig, options, getSolanaProvider, fetchEmbeddedAccounts]
  )

  // Set active wallet action
  const setActive = useCallback(
    async (setActiveOptions: SetActiveSolanaWalletOptions): Promise<void> => {
      // Prevent concurrent recoveries
      if (recoverPromiseRef.current) {
        await recoverPromiseRef.current
        return
      }

      if (wallets.length === 0) {
        const error = new OpenfortError(
          'No embedded Solana wallets available to set as active',
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

      recoverPromiseRef.current = (async (): Promise<SetActiveSolanaWalletResult> => {
        try {
          // Find account to recover by address only
          const embeddedAccountToRecover = embeddedAccounts.find(
            (account) => account.address.toLowerCase() === setActiveOptions.address.toLowerCase()
          )

          if (!embeddedAccountToRecover) {
            throw new OpenfortError(
              `No embedded Solana account found for address ${setActiveOptions.address}`,
              OpenfortErrorType.WALLET_ERROR
            )
          }

          // Build recovery params
          const recoveryParams = await buildRecoveryParams(setActiveOptions, walletConfig)

          // Recover the embedded wallet
          const embeddedAccount = await client.embeddedWallet.recover({
            account: embeddedAccountToRecover.id,
            recoveryParams,
          })

          // Get provider
          const solProvider = await getSolanaProvider(embeddedAccount)
          setProvider(solProvider)

          // Find the wallet index in the accounts list
          const walletIndex = embeddedAccounts.findIndex(
            (acc) => acc.address.toLowerCase() === embeddedAccount.address.toLowerCase()
          )

          const wallet: ConnectedEmbeddedSolanaWallet = {
            address: embeddedAccount.address,
            chainType: ChainTypeEnum.SVM,
            walletIndex: walletIndex >= 0 ? walletIndex : 0,
            getProvider: async () => solProvider,
          }

          recoverPromiseRef.current = null
          setStatus({ status: 'success' })
          setActiveWalletId(embeddedAccount.id)
          setActiveAccount(embeddedAccount)

          onSuccess({
            options: setActiveOptions,
            data: {
              wallet,
              provider: solProvider,
            },
          })

          if (setActiveOptions.onSuccess) {
            setActiveOptions.onSuccess({ wallet, provider: solProvider })
          }
          if (options.onSetActiveSuccess) {
            options.onSetActiveSuccess(wallet, solProvider)
          }

          return { wallet, provider: solProvider }
        } catch (e) {
          recoverPromiseRef.current = null
          const error =
            e instanceof OpenfortError
              ? e
              : new OpenfortError('Failed to set active Solana wallet', OpenfortErrorType.WALLET_ERROR)
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
    [client, walletConfig, embeddedAccounts, options, wallets.length, getSolanaProvider]
  )

  // Build active wallet from embeddedWallet.get()
  const activeWallet = useMemo((): ConnectedEmbeddedSolanaWallet | null => {
    if (!activeWalletId || !activeAccount) return null

    // Find the wallet index in the accounts list
    const accountIndex = embeddedAccounts.findIndex((acc) => acc.id === activeWalletId)

    return {
      address: activeAccount.address,
      chainType: ChainTypeEnum.SVM,
      walletIndex: accountIndex >= 0 ? accountIndex : 0,
      getProvider: async () => await getSolanaProvider(activeAccount),
    }
  }, [activeWalletId, activeAccount, embeddedAccounts, getSolanaProvider])

  // Build discriminated union state
  const state: EmbeddedSolanaWalletState = useMemo(() => {
    const baseActions = {
      create,
      wallets,
      setActive,
    }

    // Priority 1: Explicit action states (user-initiated operations)
    if (status.status === 'creating') {
      return { ...baseActions, status: 'creating', activeWallet: null }
    }

    if (status.status === 'connecting' || status.status === 'reconnecting' || status.status === 'loading') {
      return { ...baseActions, status: 'connecting' }
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
      return { ...baseActions, status: 'connecting' }
    }

    // Default: disconnected (authenticated but no wallet selected)
    return { ...baseActions, status: 'disconnected', activeWallet: null }
  }, [status, activeWallet, activeAccount, provider, wallets, embeddedState, create, setActive])

  return state
}
