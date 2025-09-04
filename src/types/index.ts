import { 
    AuthPlayerResponse,
    OAuthProvider,
    Provider,
    EmbeddedAccount
} from '@openfort/openfort-js';

import type { UserWallet } from './wallet';

/**
 * Core Openfort hook interface
 */
export interface UseOpenfort {
    // Core state
    /** The current authenticated user, or null when unauthenticated */
    user: AuthPlayerResponse | null;
    /** Whether or not the SDK has initialized and is ready for use */
    isReady: boolean;
    /** Any error encountered during SDK initialization */
    error: Error | null;
    /** A function that logs the current user out and clears any stored tokens */
    logout: () => Promise<void>;
    /** A function that gets the current authenticated user's access token */
    getAccessToken: () => Promise<string | null>;

    // OAuth provider functionality
    /** Check if a specific OAuth provider is currently loading */
    isProviderLoading: (provider: OAuthProvider) => boolean;
    /** Check if a specific OAuth provider is linked to the current user */
    isProviderLinked: (provider: string) => boolean;
    /** Link an OAuth provider to the current user account */
    linkProvider: (provider: OAuthProvider) => Promise<void>;

    // Authentication functionality
    /** Sign up as a guest user */
    signUpGuest: () => Promise<AuthPlayerResponse>;
    /** Sign in with an OAuth provider */
    signInWithProvider: (provider: OAuthProvider, redirectUri?: string) => Promise<AuthPlayerResponse>;
    /** Whether any authentication process is currently running */
    isAuthenticating: boolean;
    /** Any authentication error that occurred */
    authError: Error | null;
    /** Sign out the current user */
    signOut: () => Promise<void>;

    // User functionality
    /** Whether user is ready (authenticated and SDK is initialized) */
    isUserReady: boolean;
    /** Any user-related error */
    userError: Error | null;

    // Wallet functionality
    /** Array of user's wallets */
    wallets: UserWallet[] | null;
    /** Set the active wallet for transactions */
    setActiveWallet: (params: { address: string; chainId: number; onSuccess?: () => void; onError?: (error: Error) => void }) => Promise<void>;
    /** Create a new wallet for the user */
    createWallet: (callbacks?: { onSuccess?: (wallet: UserWallet) => void; onError?: (error: Error) => void }) => Promise<UserWallet>;
    /** The currently active wallet */
    activeWallet: UserWallet | null;
    /** Whether a wallet is currently being created */
    isCreatingWallet: boolean;
    /** Sign a message with a wallet */
    signMessage: (wallet: UserWallet, message: string) => Promise<string>;
    /** Switch chain for a wallet */
    switchChain: (wallet: UserWallet, chainId: string) => Promise<void>;
    /** Whether a chain switch is currently in progress */
    isSwitchingChain: boolean;
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
    UserWallet,
    OpenfortEmbeddedWalletAccount,
    WalletRecoveryCallbacks,
    SolanaWalletRecoveryCallbacks,
    RecoveryMethodOptions,
    CreateSolanaEmbeddedWalletOpts,
    RecoverSolanaEmbeddedWalletOpts,
    EmbeddedEthereumWalletActions,
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
    UseGuestAuth,
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
    onCreateWalletSuccess?: (provider: Provider) => void;
    onCreateWalletError?: (error: Error) => void;
    onSetWalletRecoverySuccess?: (result: { user: AuthPlayerResponse }) => void;
    onSetWalletRecoveryError?: (error: Error) => void;
};

/**
 * Embedded Solana wallet hook options with callbacks
 */
export type UseEmbeddedSolanaWallet = {
    onCreateWalletSuccess?: (account: EmbeddedAccount) => void;
    onCreateWalletError?: (error: Error) => void;
};