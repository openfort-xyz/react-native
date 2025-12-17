import type { EmbeddedAccount } from '@openfort/openfort-js'
import type { OpenfortEmbeddedSolanaWalletProvider } from '../../types/wallet'

type SignMessageRequestArguments = {
  method: 'signMessage'
  params: {
    message: string
  }
}

type SignTransactionRequestArguments<T = any> = {
  method: 'signTransaction'
  params: {
    transaction: T
  }
}

type RequestArguments = SignMessageRequestArguments | SignTransactionRequestArguments

/**
 * Embedded Solana wallet provider implementation for Openfort.
 *
 * This provider implements the request-based API pattern similar to EIP-1193
 * but adapted for Solana operations.
 */
export class OpenfortSolanaProvider implements OpenfortEmbeddedSolanaWalletProvider {
  private _account: EmbeddedAccount
  private _signTransaction: (transaction: any) => Promise<any>
  private _signAllTransactions: (transactions: any[]) => Promise<any[]>
  private _signMessage: (message: string) => Promise<string>

  /**
   * Legacy API for reading the public key for this provider.
   * @deprecated Use publicKey getter instead
   */
  readonly _publicKey: string

  /**
   * Creates a new OpenfortSolanaProvider instance
   * @param params - Provider configuration
   * @param params.account - The embedded account to use for this provider
   * @param params.signTransaction - Function to sign a single transaction
   * @param params.signAllTransactions - Function to sign multiple transactions
   * @param params.signMessage - Function to sign a message
   */
  constructor(params: {
    account: EmbeddedAccount
    signTransaction: (transaction: any) => Promise<any>
    signAllTransactions: (transactions: any[]) => Promise<any[]>
    signMessage: (message: string) => Promise<string>
  }) {
    this._account = params.account
    this._publicKey = params.account.address
    this._signTransaction = params.signTransaction
    this._signAllTransactions = params.signAllTransactions
    this._signMessage = params.signMessage
  }

  /**
   * The public key of the wallet (Solana address)
   */
  get publicKey(): string {
    return this._account.address
  }

  /**
   * Request-based API for wallet operations
   */
  async request(args: SignMessageRequestArguments): Promise<{ signature: string }>
  async request(args: SignTransactionRequestArguments): Promise<{ signedTransaction: any }>
  async request(args: RequestArguments): Promise<any> {
    switch (args.method) {
      case 'signMessage': {
        // Convert message string to Uint8Array
        const signature = await this._signMessage(args.params.message)
        return { signature: signature }
      }
      case 'signTransaction': {
        const signedTransaction = await this._signTransaction(args.params.transaction)
        return { signedTransaction }
      }

      default:
        throw new Error(`Unsupported method: ${(args as any).method}`)
    }
  }

  /**
   * Sign a single transaction (direct method)
   */
  async signTransaction(transaction: any): Promise<any> {
    return await this._signTransaction(transaction)
  }

  /**
   * Sign multiple transactions (direct method)
   */
  async signAllTransactions(transactions: any[]): Promise<any[]> {
    return await this._signAllTransactions(transactions)
  }

  /**
   * Sign a message (direct method)
   */
  async signMessage(message: string): Promise<string> {
    return await this._signMessage(message)
  }

  /**
   * Pretty log output for when an instance of this class is `console.log`'d
   */
  toJSON(): string {
    return `OpenfortSolanaProvider(${this.publicKey})`
  }
}
