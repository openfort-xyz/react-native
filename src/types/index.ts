
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
    PasswordLoginHookOptions,
    PasswordLinkHookOptions,
    PasswordLoginHookResult,
    PasswordLinkHookResult,
    GenerateSiweMessageResponse,
    GenerateSiweMessage,
} from './auth';

// OAuth types
export type {
    OAuthFlowState,
    OAuthHookOptions,
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
    EmbeddedWallet,
    WalletRecoveryCallbacks,
    SolanaWalletRecoveryCallbacks,
    RecoveryMethodOptions,
    CreateOrRecoverEmbeddedWalletProps,
    CreateEthereumEmbeddedWalletOpts,
    RecoverEthereumEmbeddedWalletOpts,
    CreateSolanaEmbeddedWalletOpts,
    RecoverSolanaEmbeddedWalletOpts,
    SetRecoveryProps,
    EmbeddedWalletActions,
    EmbeddedWalletConnectedState,
    EmbeddedWalletConnectingState,
    EmbeddedWalletReconnectingState,
    EmbeddedWalletDisconnectedState,
    EmbeddedWalletNeedsRecoveryState,
    EmbeddedWalletNotCreatedState,
    EmbeddedWalletCreatingState,
    EmbeddedWalletErrorState,
    EmbeddedWalletState,
    EmbeddedWalletStatus,
    ConnectedEmbeddedSolanaWallet,
    EmbeddedSolanaWalletActions,
    EmbeddedSolanaWalletConnectedState,
    EmbeddedSolanaWalletConnectingState,
    EmbeddedSolanaWalletReconnectingState,
    EmbeddedSolanaWalletDisconnectedState,
    EmbeddedSolanaWalletNeedsRecoveryState,
    EmbeddedSolanaWalletNotCreatedState,
    EmbeddedSolanaWalletCreatingState,
    EmbeddedSolanaWalletErrorState,
    EmbeddedSolanaWalletState,
    EmbeddedSolanaWalletStatus,
    ConnectedEthereumWallet,
} from './wallet';

// Configuration and utility types
export type {
    CustomAuthProviderConfig,
    OpenfortConfig,
    SessionSigner,
    AddSessionSignersInput,
    AddSessionSignersOutput,
    RemoveSessionSignersInput,
    RemoveSessionSignersOutput,
    UseSessionSignersInterface,
    SendEmailCodeInput,
    UpdateEmailInput,
    UseUpdateEmailInterface,
    SendPhoneCodeInput,
    UpdatePhoneInput,
    UseUpdatePhoneInterface,
    UseCreateGuestAccountOptions,
    UseCreateGuestAccount,
    UseOnEmbeddedWalletStateChange,
    SetRecoveryParams,
    UseSetEmbeddedWalletRecoveryResult,
    UseSetEmbeddedWalletRecovery,
    RecoverParams,
    UseRecoverEmbeddedWallet,
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

// Additional commonly used types that might be missing

/**
 * @deprecated Use `OpenfortUser` type instead
 */
export type User = import('@Openfort-io/public-api').OpenfortUser;

/**
 * @deprecated Use `OpenfortLinkedAccount` type instead
 */
export type LinkedAccountWithMetadata = import('@Openfort-io/public-api').OpenfortLinkedAccount;

/**
 * Core Openfort hook interface
 */
export interface UseOpenfort {
    /** The current authenticated user, or null when unauthenticated */
    user: import('@Openfort-io/public-api').OpenfortUser | null;
    /** Whether or not the SDK has initialized and is ready for use */
    isReady: boolean;
    /** Any error encountered during SDK initialization */
    error: Error | null;
    /** A function that logs the current user out and clears any stored tokens */
    logout: () => Promise<void>;
    /** A function that gets the current authenticated user's access token */
    getAccessToken: () => Promise<string | null>;
}

/**
 * Embedded Ethereum wallet hook interface
 */
export interface UseEmbeddedEthereumWallet {
    /** List of embedded ethereum wallets */
    wallets: ConnectedEthereumWallet[];
    /** Creates an Ethereum account */
    create: (opts?: { createAdditional?: boolean }) => Promise<{
        user: import('@Openfort-io/public-api').OpenfortUser;
    }>;
}

/**
 * Embedded wallet hook options with callbacks
 */
export type UseEmbeddedWallet = {
    onCreateWalletSuccess?: (wallet: import('@Openfort-io/js-sdk-core').OpenfortEmbeddedWalletProvider) => void;
    onCreateWalletError?: (error: Error) => void;
    onRecoverWalletSuccess?: (wallet: import('@Openfort-io/js-sdk-core').OpenfortEmbeddedWalletProvider) => void;
    onRecoverWalletError?: (error: Error) => void;
    onSetWalletRecoverySuccess?: (wallet: import('@Openfort-io/js-sdk-core').OpenfortEmbeddedWalletProvider) => void;
    onSetWalletRecoveryError?: (error: Error) => void;
};

/**
 * Embedded Solana wallet hook options with callbacks
 */
export type UseEmbeddedSolanaWallet = {
    onCreateWalletSuccess?: (wallet: import('@Openfort-io/js-sdk-core').OpenfortEmbeddedSolanaWalletProvider) => void;
    onCreateWalletError?: (error: Error) => void;
    onRecoverWalletSuccess?: (wallet: import('@Openfort-io/js-sdk-core').OpenfortEmbeddedSolanaWalletProvider) => void;
    onRecoverWalletError?: (error: Error) => void;
};