import type { EmbeddedAccount } from '@openfort/openfort-js'
import type {
  OpenfortEmbeddedSolanaWalletProvider,
  SignedSolanaTransaction,
  SolanaSignMessageRequest,
  SolanaSignTransactionRequest,
  SolanaTransaction,
} from '../../types/wallet'

type SolanaRequestArguments = SolanaSignMessageRequest | SolanaSignTransactionRequest

/**
 * Embedded Solana wallet provider implementation for Openfort.
 *
 * This provider implements the request-based API pattern similar to EIP-1193
 * but adapted for Solana operations.
 */
export class OpenfortSolanaProvider implements OpenfortEmbeddedSolanaWalletProvider {
  private _account: EmbeddedAccount
  private _signTransaction: (transaction: SolanaTransaction) => Promise<SignedSolanaTransaction>
  private _signAllTransactions: (transactions: SolanaTransaction[]) => Promise<SignedSolanaTransaction[]>
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
    signTransaction: (transaction: SolanaTransaction) => Promise<SignedSolanaTransaction>
    signAllTransactions: (transactions: SolanaTransaction[]) => Promise<SignedSolanaTransaction[]>
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
  request(args: SolanaSignMessageRequest): Promise<{ signature: string }>
  request(args: SolanaSignTransactionRequest): Promise<{ signedTransaction: SignedSolanaTransaction }>
  async request(
    args: SolanaRequestArguments
  ): Promise<{ signature: string } | { signedTransaction: SignedSolanaTransaction }> {
    switch (args.method) {
      case 'signMessage': {
        const signature = await this._signMessage(args.params.message)
        return { signature }
      }
      case 'signTransaction': {
        const signedTransaction = await this._signTransaction(args.params.transaction)
        return { signedTransaction }
      }
    }
  }

  /**
   * Sign a single transaction (direct method)
   */
  async signTransaction(transaction: SolanaTransaction): Promise<SignedSolanaTransaction> {
    return await this._signTransaction(transaction)
  }

  /**
   * Sign multiple transactions (direct method)
   */
  async signAllTransactions(transactions: SolanaTransaction[]): Promise<SignedSolanaTransaction[]> {
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
