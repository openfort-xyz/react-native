/**
 * Core Openfort hook interface.
 */
export interface UseOpenfort {
  isReady: boolean
  /** Any error encountered during SDK initialization. */
  error: Error | null
}

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
  ConnectedEmbeddedEthereumWallet,
  ConnectedEmbeddedSolanaWallet,
  CreateSolanaEmbeddedWalletOpts,
  EmbeddedEthereumWalletState,
  EmbeddedSolanaWalletState,
  OpenfortEmbeddedEthereumWalletProvider,
  OpenfortEmbeddedSolanaWalletProvider,
} from './wallet'
