/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ChainTypeEnum } from '@openfort/openfort-js'

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Ethereum wallet provider interface for EIP-1193 compatible operations
 */
export interface OpenfortEmbeddedEthereumWalletProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>
  on: (event: string, handler: (...args: any[]) => void) => void
  removeListener: (event: string, handler: (...args: any[]) => void) => void
  [key: string]: any
}

/**
 * Solana wallet provider interface
 */
export interface OpenfortEmbeddedSolanaWalletProvider {
  signMessage: (message: string) => Promise<string>
  signTransaction: (transaction: any) => Promise<any>
  signAllTransactions: (transactions: any[]) => Promise<any[]>
  publicKey: string
  [key: string]: any
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
// Wallet Creation/Recovery Options
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
   * Create additional wallet if one already exists
   */
  createAdditional?: boolean
}

// ============================================================================
// Hook Return Types (discriminated unions based on status)
// ============================================================================

/**
 * Ethereum wallet hook return type - discriminated union based on status
 */
export type EmbeddedEthereumWalletState =
  | {
      status: 'disconnected'
      activeWallet: null
      create: (...args: any[]) => Promise<any>
      wallets: ConnectedEmbeddedEthereumWallet[]
      setActive: (...args: any[]) => Promise<void>
      setRecovery: (...args: any[]) => Promise<void>
      exportPrivateKey: (...args: any[]) => Promise<any>
    }
  | {
      status: 'connecting'
      activeWallet: ConnectedEmbeddedEthereumWallet
      create: (...args: any[]) => Promise<any>
      wallets: ConnectedEmbeddedEthereumWallet[]
      setActive: (...args: any[]) => Promise<void>
      setRecovery: (...args: any[]) => Promise<void>
      exportPrivateKey: (...args: any[]) => Promise<any>
    }
  | {
      status: 'reconnecting'
      activeWallet: ConnectedEmbeddedEthereumWallet
      create: (...args: any[]) => Promise<any>
      wallets: ConnectedEmbeddedEthereumWallet[]
      setActive: (...args: any[]) => Promise<void>
      setRecovery: (...args: any[]) => Promise<void>
      exportPrivateKey: (...args: any[]) => Promise<any>
    }
  | {
      status: 'creating'
      activeWallet: null
      create: (...args: any[]) => Promise<any>
      wallets: ConnectedEmbeddedEthereumWallet[]
      setActive: (...args: any[]) => Promise<void>
      setRecovery: (...args: any[]) => Promise<void>
      exportPrivateKey: (...args: any[]) => Promise<any>
    }
  | {
      status: 'needs-recovery'
      activeWallet: ConnectedEmbeddedEthereumWallet
      create: (...args: any[]) => Promise<any>
      wallets: ConnectedEmbeddedEthereumWallet[]
      setActive: (...args: any[]) => Promise<void>
      setRecovery: (...args: any[]) => Promise<void>
      exportPrivateKey: (...args: any[]) => Promise<any>
    }
  | {
      status: 'connected'
      activeWallet: ConnectedEmbeddedEthereumWallet
      provider: OpenfortEmbeddedEthereumWalletProvider
      create: (...args: any[]) => Promise<any>
      wallets: ConnectedEmbeddedEthereumWallet[]
      setActive: (...args: any[]) => Promise<void>
      setRecovery: (...args: any[]) => Promise<void>
      exportPrivateKey: (...args: any[]) => Promise<any>
    }
  | {
      status: 'error'
      activeWallet: ConnectedEmbeddedEthereumWallet | null
      error: string
      create: (...args: any[]) => Promise<any>
      wallets: ConnectedEmbeddedEthereumWallet[]
      setActive: (...args: any[]) => Promise<void>
      setRecovery: (...args: any[]) => Promise<void>
      exportPrivateKey: (...args: any[]) => Promise<any>
    }

/**
 * Solana wallet hook return type - discriminated union based on status
 */
export type EmbeddedSolanaWalletState =
  | {
      status: 'disconnected'
      activeWallet: null
      create: (...args: any[]) => Promise<any>
      wallets: ConnectedEmbeddedSolanaWallet[]
      setActive: (...args: any[]) => Promise<void>
    }
  | {
      status: 'connecting'
      create: (...args: any[]) => Promise<any>
      wallets: ConnectedEmbeddedSolanaWallet[]
      setActive: (...args: any[]) => Promise<void>
    }
  | {
      status: 'reconnecting'
      activeWallet: ConnectedEmbeddedSolanaWallet
      create: (...args: any[]) => Promise<any>
      wallets: ConnectedEmbeddedSolanaWallet[]
      setActive: (...args: any[]) => Promise<void>
    }
  | {
      status: 'creating'
      activeWallet: null
      create: (...args: any[]) => Promise<any>
      wallets: ConnectedEmbeddedSolanaWallet[]
      setActive: (...args: any[]) => Promise<void>
    }
  | {
      status: 'needs-recovery'
      activeWallet: ConnectedEmbeddedSolanaWallet
      create: (...args: any[]) => Promise<any>
      wallets: ConnectedEmbeddedSolanaWallet[]
      setActive: (...args: any[]) => Promise<void>
    }
  | {
      status: 'connected'
      activeWallet: ConnectedEmbeddedSolanaWallet
      provider: OpenfortEmbeddedSolanaWalletProvider
      create: (...args: any[]) => Promise<any>
      wallets: ConnectedEmbeddedSolanaWallet[]
      setActive: (...args: any[]) => Promise<void>
    }
  | {
      status: 'error'
      activeWallet: ConnectedEmbeddedSolanaWallet | null
      error: string
      create: (...args: any[]) => Promise<any>
      wallets: ConnectedEmbeddedSolanaWallet[]
      setActive: (...args: any[]) => Promise<void>
    }
