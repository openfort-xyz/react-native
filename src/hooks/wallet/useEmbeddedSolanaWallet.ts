import { AccountTypeEnum, ChainTypeEnum, type EmbeddedAccount, EmbeddedState } from '@openfort/openfort-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOpenfortContext } from '../../core/context'
import { onError, onSuccess } from '../../lib/hookConsistency'
import { logger } from '../../lib/logger'
import type { BaseFlowState } from '../../types/baseFlowState'
import { OpenfortError, OpenfortErrorType } from '../../types/openfortError'
import type {
  ConnectedEmbeddedSolanaWallet,
  CreateSolanaWalletOptions,
  EmbeddedSolanaWalletState,
  OpenfortEmbeddedSolanaWalletProvider,
  SetActiveSolanaWalletOptions,
  SetActiveSolanaWalletResult,
  SignedSolanaTransaction,
  SolanaTransaction,
} from '../../types/wallet'
import { OpenfortSolanaProvider } from './solanaProvider'
import { buildRecoveryParams } from './utils'

type UseEmbeddedSolanaWalletOptions = {
  onCreateSuccess?: (account: EmbeddedAccount, provider: OpenfortEmbeddedSolanaWalletProvider) => void
  onCreateError?: (error: OpenfortError) => void
  onSetActiveSuccess?: (wallet: ConnectedEmbeddedSolanaWallet, provider: OpenfortEmbeddedSolanaWalletProvider) => void
  onSetActiveError?: (error: OpenfortError) => void
}

type WalletFlowStatus =
  | BaseFlowState
  | {
      status: 'creating' | 'connecting' | 'reconnecting' | 'disconnected' | 'needs-recovery' | 'fetching-wallets'
      error?: never
    }

/**
 * Hook for managing embedded Solana wallets.
 *
 * This hook provides comprehensive management of embedded Solana (SVM) wallets including
 * creation, recovery, activation, and transaction signing. Returns a discriminated union
 * state that enables type-safe wallet interactions based on connection status.
 *
 * **Note:** Solana wallets are always EOA (Externally Owned Accounts) and work across
 * all Solana networks (mainnet, devnet, testnet).
 *
 * **Recovery Methods:**
 * - Automatic recovery (via encryption session)
 * - Password-based recovery
 *
 * @param options - Configuration options including:
 *   - `onCreateSuccess` - Callback when wallet is created
 *   - `onCreateError` - Callback when wallet creation fails
 *   - `onSetActiveSuccess` - Callback when wallet is activated/recovered
 *   - `onSetActiveError` - Callback when wallet activation fails
 *
 * @returns Discriminated union state based on `status` field:
 *   - **'disconnected'**: No active wallet. Properties: `create`, `setActive`, `wallets`
 *   - **'connecting'**: Activating wallet. Properties: same as disconnected
 *   - **'reconnecting'**: Reconnecting to wallet. Properties: same as disconnected + `activeWallet`
 *   - **'creating'**: Creating new wallet. Properties: same as disconnected
 *   - **'needs-recovery'**: Recovery required. Properties: same as reconnecting
 *   - **'connected'**: Wallet ready. Properties: all + `provider` (Solana wallet adapter)
 *   - **'error'**: Operation failed. Properties: all + `error` message + optional `activeWallet`
 *
 * @example
 * ```tsx
 * import { useEmbeddedSolanaWallet } from '@openfort/react-native';
 * import { Transaction } from '@solana/web3.js';
 * import { ActivityIndicator } from 'react-native';
 *
 * function SolanaWalletComponent() {
 *   const solana = useEmbeddedSolanaWallet({
 *     onCreateSuccess: (account, provider) => {
 *       console.log('Solana wallet created:', account.address);
 *       console.log('Public key:', provider.publicKey);
 *     },
 *   });
 *
 *   // Handle loading states
 *   if (solana.status === 'creating' || solana.status === 'connecting') {
 *     return <ActivityIndicator />;
 *   }
 *
 *   // Create first wallet
 *   if (solana.status === 'disconnected' && solana.wallets.length === 0) {
 *     return (
 *       <Button
 *         onPress={() => solana.create({ recoveryPassword: 'optional' })}
 *         title="Create Solana Wallet"
 *       />
 *     );
 *   }
 *
 *   // Activate existing wallet
 *   if (solana.status === 'disconnected' && solana.wallets.length > 0) {
 *     return (
 *       <Button
 *         onPress={() => solana.setActive({
 *           address: solana.wallets[0].address,
 *           recoveryPassword: 'optional'
 *         })}
 *         title="Connect Solana Wallet"
 *       />
 *     );
 *   }
 *
 *   // Use connected wallet
 *   if (solana.status === 'connected') {
 *     const signTransaction = async () => {
 *       const transaction = new Transaction();
 *       // ... add instructions to transaction
 *
 *       const signed = await solana.provider.signTransaction(transaction);
 *       console.log('Signed transaction:', signed);
 *     };
 *
 *     const signMessage = async () => {
 *       const message = 'Hello Solana!';
 *       const signature = await solana.provider.signMessage(message);
 *       console.log('Message signature:', signature);
 *     };
 *
 *     return (
 *       <View>
 *         <Text>Connected: {solana.activeWallet.address}</Text>
 *         <Button onPress={signTransaction} title="Sign Transaction" />
 *         <Button onPress={signMessage} title="Sign Message" />
 *       </View>
 *     );
 *   }
 *
 *   return null;
 * }
 * ```
 */
export function useEmbeddedSolanaWallet(options: UseEmbeddedSolanaWalletOptions = {}): EmbeddedSolanaWalletState {
  const { client, walletConfig, embeddedState, user } = useOpenfortContext()
  const [embeddedAccounts, setEmbeddedAccounts] = useState<EmbeddedAccount[]>([])
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null)
  const [activeAccount, setActiveAccount] = useState<EmbeddedAccount | null>(null)
  const [provider, setProvider] = useState<OpenfortEmbeddedSolanaWalletProvider | null>(null)
  const recoverPromiseRef = useRef<Promise<SetActiveSolanaWalletResult> | null>(null)

  const [status, setStatus] = useState<WalletFlowStatus>({
    status: 'idle',
  })

  // Fetch Solana embedded accounts
  const fetchEmbeddedAccounts = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!client || embeddedState === EmbeddedState.NONE || embeddedState === EmbeddedState.UNAUTHENTICATED) {
        setEmbeddedAccounts([])
        return
      }

      try {
        // Only set fetching status if not called silently (e.g., during create/setActive)
        if (!options?.silent) {
          setStatus({ status: 'fetching-wallets' })
        }
        const accounts = await client.embeddedWallet.list({
          chainType: ChainTypeEnum.SVM,
          accountType: AccountTypeEnum.EOA,
          limit: 100,
        })
        setEmbeddedAccounts(accounts)
        if (!options?.silent) {
          setStatus({ status: 'idle' })
        }
      } catch {
        setEmbeddedAccounts([])
        if (!options?.silent) {
          setStatus({ status: 'idle' })
        }
      }
    },
    [client, embeddedState]
  )

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
      const signSingleTransaction = async (transaction: SolanaTransaction): Promise<SignedSolanaTransaction> => {
        // Extract the message bytes from the transaction
        // For @solana/kit compiledTransaction, the messageBytes property contains what needs to be signed
        let messageBytes: Uint8Array

        if (transaction instanceof Uint8Array) {
          // Raw bytes
          messageBytes = transaction
        } else if ('messageBytes' in transaction) {
          // @solana/kit compiled transaction
          messageBytes = transaction.messageBytes
        } else if ('serializeMessage' in transaction) {
          // @solana/web3.js Transaction
          messageBytes = transaction.serializeMessage()
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
        // Note: We cast to unknown because the iframe will deserialize the Buffer format correctly,
        // but TypeScript doesn't know about this serialization detail
        const signatureBase58 = await client.embeddedWallet.signMessage(bufferFormatMessage as unknown as Uint8Array, {
          hashMessage: false,
        })

        // Return the signature in the expected format
        return {
          signature: signatureBase58,
          publicKey: account.address,
        }
      }

      const provider = new OpenfortSolanaProvider({
        account,
        signTransaction: signSingleTransaction,
        signAllTransactions: async (transactions: SolanaTransaction[]): Promise<SignedSolanaTransaction[]> => {
          // Sign each transaction sequentially
          const signedTransactions: SignedSolanaTransaction[] = []
          for (const transaction of transactions) {
            const signed = await signSingleTransaction(transaction)
            signedTransactions.push(signed)
          }
          return signedTransactions
        },
        signMessage: async (message: string): Promise<string> => {
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

        // Build recovery params (only use recoveryPassword, otpCode, and userId, ignore createAdditional)
        const recoveryParams = await buildRecoveryParams(
          createOptions?.recoveryPassword || createOptions?.otpCode || user?.id
            ? { recoveryPassword: createOptions?.recoveryPassword, otpCode: createOptions?.otpCode, userId: user?.id }
            : undefined,
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

        // Refresh accounts silently (don't override 'creating' status) and set as active
        await fetchEmbeddedAccounts({ silent: true })
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
    [client, walletConfig, options, getSolanaProvider, fetchEmbeddedAccounts, user]
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
          const recoveryParams = await buildRecoveryParams({ ...setActiveOptions, userId: user?.id }, walletConfig)

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
    [client, walletConfig, embeddedAccounts, options, wallets.length, getSolanaProvider, user]
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
    if (status.status === 'fetching-wallets') {
      return { ...baseActions, status: 'fetching-wallets', activeWallet: null }
    }

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
