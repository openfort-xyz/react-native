/**
 * Core Openfort hook interface.
 */
export interface UseOpenfort {
  /** The current authenticated user, or null when unauthenticated. */
  user: import('@openfort/openfort-js').AuthPlayerResponse | null
  /** Whether or not the SDK has initialized and is ready for use. */
  isReady: boolean
  /** Any error encountered during SDK initialization. */
  error: Error | null
  /** A function that logs the current user out and clears any stored tokens. */
  logout: () => Promise<void>
  /** A function that gets the current authenticated user's access token. */
  getAccessToken: () => Promise<string | null>
}

// Authentication types
export type {
  AuthLinkSuccessCallback,
  AuthSuccessCallback,
  CustomAuthFlowState,
  EmailLinkHookOptions,
  EmailLinkHookResult,
  EmailLoginHookOptions,
  EmailLoginHookResult,
  ErrorCallback,
  GenerateSiweMessage,
  GenerateSiweMessageResponse,
  PasswordFlowState,
  RecoveryFlowState,
  SiweFlowState,
  SiweLinkHookOptions,
  SiweLinkHookResult,
  SiweLoginHookOptions,
  SiweLoginHookResult,
} from './auth'
// Configuration and utility types
export type {
  CustomAuthProviderConfig,
  SetRecoveryParams,
  UseGuestAuth,
  UseOnEmbeddedWalletStateChange,
  UseSetEmbeddedWalletRecovery,
  UseSetEmbeddedWalletRecoveryResult,
} from './config'
// OAuth types
export type {
  LinkWithOAuthInput,
  LoginWithOAuthInput,
  OAuthFlowState,
  OAuthTokens,
  UnlinkOAuthOptions,
  UnlinkOAuthParams,
  UseLinkWithOAuth,
  UseLoginWithOAuth,
  UseOAuthTokensOptions,
} from './oauth'
// Predicate functions (exported directly, not as types)
export {
  canTransact,
  getActionText,
  getStateDescription,
  hasError,
  isConnected,
  isConnecting,
  isCreating,
  isDisconnected,
  isLoading,
  isNotCreated,
  isReady,
  isReconnecting,
  isStable,
  needsRecovery,
  needsUserAction,
} from './predicates'
// Wallet types
export type {
  ConnectedEmbeddedEthereumWallet,
  ConnectedEmbeddedSolanaWallet,
  CreateSolanaEmbeddedWalletOpts,
  EmbeddedEthereumWalletActions,
  EmbeddedEthereumWalletState,
  EmbeddedSolanaWalletActions,
  EmbeddedSolanaWalletConnectedState,
  EmbeddedSolanaWalletConnectingState,
  EmbeddedSolanaWalletCreatingState,
  EmbeddedSolanaWalletDisconnectedState,
  EmbeddedSolanaWalletErrorState,
  EmbeddedSolanaWalletNeedsRecoveryState,
  EmbeddedSolanaWalletReconnectingState,
  EmbeddedSolanaWalletState,
  EmbeddedSolanaWalletStatus,
  EmbeddedWalletStatus,
  OpenfortEmbeddedWalletAccount,
  RecoverSolanaEmbeddedWalletOpts,
  RecoveryMethodOptions,
  SolanaWalletRecoveryCallbacks,
  UserWallet,
  WalletRecoveryCallbacks,
} from './wallet'

/**
 * Embedded wallet hook options with callbacks.
 */
export type UseEmbeddedEthereumWallet = {
  onCreateWalletSuccess?: (provider: import('@openfort/openfort-js').Provider) => void
  onCreateWalletError?: (error: Error) => void
  onSetWalletRecoverySuccess?: (result: { user: import('@openfort/openfort-js').AuthPlayerResponse }) => void
  onSetWalletRecoveryError?: (error: Error) => void
}

/**
 * Embedded Solana wallet hook options with callbacks.
 */
export type UseEmbeddedSolanaWallet = {
  onCreateWalletSuccess?: (account: import('@openfort/openfort-js').EmbeddedAccount) => void
  onCreateWalletError?: (error: Error) => void
}
