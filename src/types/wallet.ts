import type { AccountTypeEnum, ChainTypeEnum, EmbeddedAccount, RecoveryParams } from '@openfort/openfort-js'
import type { Hex } from './hex'
import type { OpenfortHookOptions } from './hookOption'
import type { OpenfortError } from './openfortError'

// ============================================================================
// EIP-1193 Types for Ethereum Provider
// ============================================================================

/**
 * JSON-RPC request arguments following EIP-1193 spec
 */
export type EIP1193RequestArguments = {
  readonly method: string
  readonly params?: readonly unknown[] | object
}

/**
 * EIP-1193 event names
 */
export type EIP1193EventName = 'accountsChanged' | 'chainChanged' | 'connect' | 'disconnect' | 'message'

/**
 * EIP-1193 provider event handler
 */
export type EIP1193EventHandler = (...args: unknown[]) => void

/**
 * Ethereum wallet provider interface following EIP-1193 spec
 *
 * @see https://eips.ethereum.org/EIPS/eip-1193
 */
export interface OpenfortEmbeddedEthereumWalletProvider {
  /**
   * Submit a JSON-RPC request to the provider
   */
  request(args: EIP1193RequestArguments): Promise<unknown>

  /**
   * Subscribe to provider events
   */
  on(event: EIP1193EventName | string, handler: EIP1193EventHandler): void

  /**
   * Unsubscribe from provider events
   */
  removeListener(event: EIP1193EventName | string, handler: EIP1193EventHandler): void
}

// ============================================================================
// Solana Transaction Types
// ============================================================================

/**
 * Represents a Solana transaction that can be signed.
 * Supports multiple formats:
 * - @solana/web3.js Transaction (has serializeMessage method)
 * - @solana/kit compiled transaction (has messageBytes property)
 * - Raw Uint8Array
 */
export type SolanaTransaction = { messageBytes: Uint8Array } | { serializeMessage(): Uint8Array } | Uint8Array

/**
 * Result of signing a Solana transaction
 */
export type SignedSolanaTransaction = {
  signature: string
  publicKey: string
}

/**
 * Solana provider request arguments
 */
export type SolanaSignMessageRequest = {
  method: 'signMessage'
  params: { message: string }
}

export type SolanaSignTransactionRequest = {
  method: 'signTransaction'
  params: { transaction: SolanaTransaction }
}

export type SolanaRequestArguments = SolanaSignMessageRequest | SolanaSignTransactionRequest

/**
 * Solana wallet provider interface
 */
export interface OpenfortEmbeddedSolanaWalletProvider {
  /**
   * The public key (address) of the wallet
   */
  readonly publicKey: string

  /**
   * Sign a message and return the signature
   */
  signMessage(message: string): Promise<string>

  /**
   * Sign a single transaction
   */
  signTransaction(transaction: SolanaTransaction): Promise<SignedSolanaTransaction>

  /**
   * Sign multiple transactions
   */
  signAllTransactions(transactions: SolanaTransaction[]): Promise<SignedSolanaTransaction[]>

  /**
   * Request-based API (similar to EIP-1193 pattern)
   */
  request(args: SolanaSignMessageRequest): Promise<{ signature: string }>
  request(args: SolanaSignTransactionRequest): Promise<{ signedTransaction: SignedSolanaTransaction }>
}

// ============================================================================
// Connected Wallet Types
// ============================================================================

/**
 * Connected Ethereum wallet
 */
export type ConnectedEmbeddedEthereumWallet = {
  address: string
  ownerAddress?: string
  implementationType?: string
  chainType: ChainTypeEnum.EVM
  walletIndex: number
  getProvider: () => Promise<OpenfortEmbeddedEthereumWalletProvider>
}

/**
 * Connected Solana wallet
 */
export type ConnectedEmbeddedSolanaWallet = {
  address: string
  chainType: ChainTypeEnum.SVM
  walletIndex: number
  getProvider: () => Promise<OpenfortEmbeddedSolanaWalletProvider>
}

// ============================================================================
// Ethereum Wallet Action Types
// ============================================================================

/**
 * Result of creating an Ethereum wallet
 */
export type CreateEthereumWalletResult = {
  error?: OpenfortError
  account?: EmbeddedAccount
  provider?: OpenfortEmbeddedEthereumWalletProvider
}

/**
 * Options for creating an Ethereum wallet
 */
export type CreateEthereumWalletOptions = {
  chainId?: number
  recoveryPassword?: string
  /** OTP code for Shield verification when using automatic recovery */
  otpCode?: string
  accountType?: AccountTypeEnum
  policyId?: string
  /** Recovery method to use: 'automatic', 'password', or 'passkey' */
  recoveryMethod?: 'automatic' | 'password' | 'passkey'
  /** Passkey ID for passkey recovery (required when recoveryMethod is 'passkey' for recovery) */
  passkeyId?: string
} & OpenfortHookOptions<CreateEthereumWalletResult>

/**
 * Result of setting active Ethereum wallet
 */
export type SetActiveEthereumWalletResult = {
  error?: OpenfortError
  wallet?: ConnectedEmbeddedEthereumWallet
  provider?: OpenfortEmbeddedEthereumWalletProvider
}

/**
 * Options for setting active Ethereum wallet
 */
export type SetActiveEthereumWalletOptions = {
  address: Hex
  chainId?: number
  recoveryPassword?: string
  /** OTP code for Shield verification when using automatic recovery */
  otpCode?: string
  /** Recovery method to use: 'automatic', 'password', or 'passkey' */
  recoveryMethod?: 'automatic' | 'password' | 'passkey'
  /** Passkey ID for passkey recovery (required when recoveryMethod is 'passkey' for recovery) */
  passkeyId?: string
} & OpenfortHookOptions<SetActiveEthereumWalletResult>

/**
 * Result of setting recovery method
 */
export type SetRecoveryResult = {
  error?: OpenfortError
}

/**
 * Options for setting recovery method
 */
export type SetRecoveryOptions = {
  previousRecovery: RecoveryParams
  newRecovery: RecoveryParams
} & OpenfortHookOptions<SetRecoveryResult>

// ============================================================================
// Solana Wallet Action Types
// ============================================================================

/**
 * Simplified Solana wallet creation options
 */
export type CreateSolanaEmbeddedWalletOpts = {
  /**
   * Optional recovery password for password-based recovery.
   * If omitted, automatic recovery will be used.
   */
  recoveryPassword?: string
  /**
   * OTP code for Shield verification when using automatic recovery
   */
  otpCode?: string
  /**
   * Create additional wallet if one already exists
   */
  createAdditional?: boolean
  /** Recovery method to use: 'automatic', 'password', or 'passkey' */
  recoveryMethod?: 'automatic' | 'password' | 'passkey'
  /** Passkey ID for passkey recovery (required when recoveryMethod is 'passkey' for recovery) */
  passkeyId?: string
}

/**
 * Result of creating a Solana wallet
 */
export type CreateSolanaWalletResult = {
  error?: OpenfortError
  account?: EmbeddedAccount
  provider?: OpenfortEmbeddedSolanaWalletProvider
}

/**
 * Options for creating a Solana wallet
 */
export type CreateSolanaWalletOptions = CreateSolanaEmbeddedWalletOpts & OpenfortHookOptions<CreateSolanaWalletResult>

/**
 * Result of setting active Solana wallet
 */
export type SetActiveSolanaWalletResult = {
  error?: OpenfortError
  wallet?: ConnectedEmbeddedSolanaWallet
  provider?: OpenfortEmbeddedSolanaWalletProvider
}

/**
 * Options for setting active Solana wallet
 */
export type SetActiveSolanaWalletOptions = {
  address: string
  recoveryPassword?: string
  /** OTP code for Shield verification when using automatic recovery */
  otpCode?: string
  /** Recovery method to use: 'automatic', 'password', or 'passkey' */
  recoveryMethod?: 'automatic' | 'password' | 'passkey'
  /** Passkey ID for passkey recovery (required when recoveryMethod is 'passkey' for recovery) */
  passkeyId?: string
} & OpenfortHookOptions<SetActiveSolanaWalletResult>

// ============================================================================
// Ethereum Wallet State Actions Interface
// ============================================================================

/**
 * Common actions available on all Ethereum wallet states
 */
export interface EthereumWalletActions {
  /**
   * Create a new embedded Ethereum wallet
   */
  create(options?: CreateEthereumWalletOptions): Promise<EmbeddedAccount>

  /**
   * List of available wallets
   */
  wallets: ConnectedEmbeddedEthereumWallet[]

  /**
   * Set a wallet as active (recover/connect to it)
   */
  setActive(options: SetActiveEthereumWalletOptions): Promise<void>

  /**
   * Update the recovery method for the wallet
   */
  setRecovery(options: SetRecoveryOptions): Promise<void>

  /**
   * Export the private key of the active wallet
   */
  exportPrivateKey(): Promise<string>
}

// ============================================================================
// Solana Wallet State Actions Interface
// ============================================================================

/**
 * Common actions available on all Solana wallet states
 */
export interface SolanaWalletActions {
  /**
   * Create a new embedded Solana wallet
   */
  create(options?: CreateSolanaWalletOptions): Promise<EmbeddedAccount>

  /**
   * List of available wallets
   */
  wallets: ConnectedEmbeddedSolanaWallet[]

  /**
   * Set a wallet as active (recover/connect to it)
   */
  setActive(options: SetActiveSolanaWalletOptions): Promise<void>
}

// ============================================================================
// Ethereum Wallet Hook Return Types (discriminated unions based on status)
// ============================================================================

/**
 * Ethereum wallet hook return type - discriminated union based on status
 */
export type EmbeddedEthereumWalletState =
  | (EthereumWalletActions & {
      status: 'disconnected'
      activeWallet: null
    })
  | (EthereumWalletActions & {
      status: 'fetching-wallets'
      activeWallet: null
    })
  | (EthereumWalletActions & {
      status: 'connecting'
      activeWallet: ConnectedEmbeddedEthereumWallet
    })
  | (EthereumWalletActions & {
      status: 'reconnecting'
      activeWallet: ConnectedEmbeddedEthereumWallet
    })
  | (EthereumWalletActions & {
      status: 'creating'
      activeWallet: null
    })
  | (EthereumWalletActions & {
      status: 'needs-recovery'
      activeWallet: ConnectedEmbeddedEthereumWallet
    })
  | (EthereumWalletActions & {
      status: 'connected'
      activeWallet: ConnectedEmbeddedEthereumWallet
      provider: OpenfortEmbeddedEthereumWalletProvider
    })
  | (EthereumWalletActions & {
      status: 'error'
      activeWallet: ConnectedEmbeddedEthereumWallet | null
      error: string
    })

// ============================================================================
// Solana Wallet Hook Return Types (discriminated unions based on status)
// ============================================================================

/**
 * Solana wallet hook return type - discriminated union based on status
 */
export type EmbeddedSolanaWalletState =
  | (SolanaWalletActions & {
      status: 'disconnected'
      activeWallet: null
    })
  | (SolanaWalletActions & {
      status: 'fetching-wallets'
      activeWallet: null
    })
  | (SolanaWalletActions & {
      status: 'connecting'
    })
  | (SolanaWalletActions & {
      status: 'reconnecting'
      activeWallet: ConnectedEmbeddedSolanaWallet
    })
  | (SolanaWalletActions & {
      status: 'creating'
      activeWallet: null
    })
  | (SolanaWalletActions & {
      status: 'needs-recovery'
      activeWallet: ConnectedEmbeddedSolanaWallet
    })
  | (SolanaWalletActions & {
      status: 'connected'
      activeWallet: ConnectedEmbeddedSolanaWallet
      provider: OpenfortEmbeddedSolanaWalletProvider
    })
  | (SolanaWalletActions & {
      status: 'error'
      activeWallet: ConnectedEmbeddedSolanaWallet | null
      error: string
    })
