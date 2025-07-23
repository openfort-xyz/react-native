
/**
 * Core Openfort hook interface
 */
export interface UseOpenfort {
    /** The current authenticated user, or null when unauthenticated */
    user: import('@openfort/openfort-js').AuthPlayerResponse | null;
    /** Whether or not the SDK has initialized and is ready for use */
    isReady: boolean;
    /** Any error encountered during SDK initialization */
    error: Error | null;
    /** A function that logs the current user out and clears any stored tokens */
    logout: () => Promise<void>;
    /** A function that gets the current authenticated user's access token */
    getAccessToken: () => Promise<string | null>;
}

// Authentication types
export type {
    PasswordFlowState,
    SiweFlowState,
    RecoveryFlowState,
    CustomAuthFlowState,
    AuthSuccessCallback,
    AuthLinkSuccessCallback,
    ErrorCallback,
    EmailLoginHookOptions,
    EmailLinkHookOptions,
    EmailLoginHookResult,
    EmailLinkHookResult,
    SiweLoginHookOptions,
    SiweLinkHookOptions,
    SiweLoginHookResult,
    SiweLinkHookResult,
    GenerateSiweMessageResponse,
    GenerateSiweMessage,
} from './auth';

// OAuth types
export type {
    OAuthFlowState,
    OAuthTokens,
    UseOAuthTokensOptions,
    LoginWithOAuthInput,
    LinkWithOAuthInput,
    UseLoginWithOAuth,
    UseLinkWithOAuth,
    UnlinkOAuthOptions,
    UnlinkOAuthParams,
} from './oauth';

// Wallet types
export type {
    OpenfortEmbeddedWalletAccount,
    WalletRecoveryCallbacks,
    SolanaWalletRecoveryCallbacks,
    RecoveryMethodOptions,
    CreateSolanaEmbeddedWalletOpts,
    RecoverSolanaEmbeddedWalletOpts,
    EmbeddedEthereumWalletActions,
    EmbeddedEthereumWalletConnectedState,
    EmbeddedEthereumWalletConnectingState,
    EmbeddedEthereumWalletReconnectingState,
    EmbeddedEthereumWalletDisconnectedState,
    EmbeddedEthereumWalletNeedsRecoveryState,
    EmbeddedEthereumWalletCreatingState,
    EmbeddedEthereumWalletErrorState,
    EmbeddedEthereumWalletState,
    EmbeddedWalletStatus,
    ConnectedEmbeddedSolanaWallet,
    EmbeddedSolanaWalletActions,
    EmbeddedSolanaWalletConnectedState,
    EmbeddedSolanaWalletConnectingState,
    EmbeddedSolanaWalletReconnectingState,
    EmbeddedSolanaWalletDisconnectedState,
    EmbeddedSolanaWalletNeedsRecoveryState,
    EmbeddedSolanaWalletCreatingState,
    EmbeddedSolanaWalletErrorState,
    EmbeddedSolanaWalletState,
    EmbeddedSolanaWalletStatus,
    ConnectedEmbeddedEthereumWallet,
} from './wallet';

// Configuration and utility types
export type {
    CustomAuthProviderConfig,
    UseCreateGuestAccount,
    UseOnEmbeddedWalletStateChange,
    SetRecoveryParams,
    UseSetEmbeddedWalletRecoveryResult,
    UseSetEmbeddedWalletRecovery,
} from './config';


// Predicate functions (exported directly, not as types)
export {
    isConnected,
    isReconnecting,
    isConnecting,
    isDisconnected,
    isNotCreated,
    isCreating,
    hasError,
    needsRecovery,
    isLoading,
    isReady,
    needsUserAction,
    isStable,
    canTransact,
    getStateDescription,
    getActionText,
} from './predicates';

/**
 * Embedded wallet hook options with callbacks
 */
export type UseEmbeddedEthereumWallet = {
    onCreateWalletSuccess?: (provider: import('@openfort/openfort-js').Provider) => void;
    onCreateWalletError?: (error: Error) => void;
    onSetWalletRecoverySuccess?: (result: { user: import('@openfort/openfort-js').AuthPlayerResponse }) => void;
    onSetWalletRecoveryError?: (error: Error) => void;
};

/**
 * Embedded Solana wallet hook options with callbacks
 */
export type UseEmbeddedSolanaWallet = {
    onCreateWalletSuccess?: (account: import('@openfort/openfort-js').EmbeddedAccount) => void;
    onCreateWalletError?: (error: Error) => void;
};