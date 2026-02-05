/**
 * Core Openfort hook interface.
 */
export interface UseOpenfort {
  isReady: boolean
  /** Any error encountered during SDK initialization. */
  error: Error | null
}

// Passkey error types (re-exported from @openfort/openfort-js)
export {
  PASSKEY_ERROR_CODES,
  PasskeyAssertionFailedError,
  PasskeyCreationFailedError,
  type PasskeyErrorCode,
  PasskeyPRFNotSupportedError,
  PasskeySeedInvalidError,
  PasskeyUserCancelledError,
} from '@openfort/openfort-js'
// Authentication types
export type {
  AuthSuccessCallback,
  EmailLoginHookOptions,
  EmailLoginHookResult,
  ErrorCallback,
  GenerateSiweMessage,
  GenerateSiweMessageResponse,
  PasswordFlowState,
  RecoveryFlowState,
  SiweFlowState,
  SiweLoginHookOptions,
  SiweLoginHookResult,
} from './auth'
// OAuth types
export type {
  LinkWithOAuthInput,
  LoginWithOAuthInput,
  OAuthFlowState,
  UseLoginWithOAuth,
} from './oauth'
// Wallet types
export type {
  // Connected wallet types
  ConnectedEmbeddedEthereumWallet,
  ConnectedEmbeddedSolanaWallet,
  // Ethereum action types
  CreateEthereumWalletOptions,
  CreateEthereumWalletResult,
  // Solana action types
  CreateSolanaEmbeddedWalletOpts,
  CreateSolanaWalletOptions,
  CreateSolanaWalletResult,
  // Provider types
  EIP1193EventHandler,
  EIP1193EventName,
  EIP1193RequestArguments,
  // State types
  EmbeddedEthereumWalletState,
  EmbeddedSolanaWalletState,
  // Action interfaces
  EthereumWalletActions,
  OpenfortEmbeddedEthereumWalletProvider,
  OpenfortEmbeddedSolanaWalletProvider,
  SetActiveEthereumWalletOptions,
  SetActiveEthereumWalletResult,
  SetActiveSolanaWalletOptions,
  SetActiveSolanaWalletResult,
  SetRecoveryOptions,
  SetRecoveryResult,
  SignedSolanaTransaction,
  SolanaRequestArguments,
  SolanaSignMessageRequest,
  SolanaSignTransactionRequest,
  SolanaTransaction,
  SolanaWalletActions,
} from './wallet'
