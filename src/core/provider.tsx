import React, { useState, useEffect, useCallback, useMemo } from 'react';

import {
  AuthPlayerResponse,
  OpenfortConfiguration,
  ShieldConfiguration,
  RecoveryMethod,
  SDKOverrides,
  EmbeddedState,
  AccountTypeEnum,
  ThirdPartyAuthConfiguration,
  Openfort as OpenfortClient,
  OAuthProvider
} from '@openfort/openfort-js';

import type {
  PasswordFlowState,
  OAuthFlowState,
  SiweFlowState,
  RecoveryFlowState,
  UserWallet
} from '../types';

import { OpenfortContext, type OpenfortContextValue } from './context';
import { createOpenfortClient, setDefaultClient } from './client';
import { EmbeddedWalletWebView, WebViewUtils } from '../native';
import { logger, getEmbeddedStateName } from '../lib/logger';

/**
 * Custom auth configuration
 */
interface CustomAuthConfig {
  enabled: boolean;
  isLoading: boolean;
  getCustomAccessToken: () => Promise<string | null>;
}

export type CommonEmbeddedWalletConfiguration = {
  /** Publishable key for the Shield API */
  shieldPublishableKey: string;
  /** Policy ID (pol_...) for the embedded signer */
  ethereumProviderPolicyId?: string;
  debug?: boolean;
  accountType?: AccountTypeEnum;
}

export type EncryptionSession =
  | {
    /** Function to retrieve an encryption session using a session ID */
    getEncryptionSession: () => Promise<string>;
    createEncryptedSessionEndpoint?: never;
  }
  | {
    /** API endpoint for creating an encrypted session */
    createEncryptedSessionEndpoint: string;
    getEncryptionSession?: never;
  };

/**
 * Configuration for automatic recovery, which requires an encryption session.
 */
export type AutomaticRecoveryEmbeddedWalletConfiguration = {
  /** Specifies that the recovery method is automatic */
  recoveryMethod: RecoveryMethod.AUTOMATIC;
} & EncryptionSession;

export type PasswordRecoveryEmbeddedWalletConfiguration = {
  /** Specifies that the recovery method is password-based */
  recoveryMethod: RecoveryMethod.PASSWORD;
} & (
    | (EncryptionSession & {
      shieldEncryptionKey?: never;
    })
    | {
      /** Required shield encryption key when no encryption session is used */
      shieldEncryptionKey: string;
      createEncryptedSessionEndpoint?: never;
      getEncryptionSession?: never;
    }
  );

/**
 * Configuration for automatic recovery.
 * - An encryption session is required.
 * 
 * Configuration for password-based recovery.
 * - An encryption session, OR
 * - A `shieldEncryptionKey` without an encryption session.
 * 
 * Encryption session can be created using either:
 * - `createEncryptedSessionEndpoint` as a string, OR
 * - `getEncryptionSession.` as a function that returns a promise.
 */
export type EmbeddedWalletConfiguration = CommonEmbeddedWalletConfiguration & (
  AutomaticRecoveryEmbeddedWalletConfiguration | PasswordRecoveryEmbeddedWalletConfiguration
);

/**
 * These types are fully compatible with WAGMI chain types, in case
 * we need interop in the future.
 */
type RpcUrls = {
  http: readonly string[];
  webSocket?: readonly string[];
};
type NativeCurrency = {
  name: string;
  /** 2-6 characters long */
  symbol: string;
  decimals: number;
};
type BlockExplorer = {
  name: string;
  url: string;
};
/** A subset of WAGMI's chain type
 * https://github.com/wagmi-dev/references/blob/6aea7ee9c65cfac24f33173ab3c98176b8366f05/packages/chains/src/types.ts#L8
 */
export type Chain = {
  /** Id in number form */
  id: number;
  /** Human readable name */
  name: string;
  /** Internal network name */
  network?: string;
  /** Currency used by chain */
  nativeCurrency: NativeCurrency;
  /** Collection of block explorers */
  blockExplorers?: {
    [key: string]: BlockExplorer;
    default: BlockExplorer;
  };
  /** Collection of RPC endpoints */
  rpcUrls: {
    [key: string]: RpcUrls;
    default: RpcUrls;
  };
  /** Flag for test networks */
  testnet?: boolean;
};



/**
 * Starts polling the embedded wallet state and calls onChange only when the
 * state actually changes. Returns a cleanup function to stop polling.
 */
function startEmbeddedStatePolling(
  client: OpenfortClient,
  onChange: (state: EmbeddedState) => void,
  intervalMs: number = 1000,
): () => void {
  let lastState: EmbeddedState | null = null;
  let stopped = false;

  const check = async () => {
    if (stopped) return;
    try {
      const state = await client.embeddedWallet.getEmbeddedState();
      if (state !== lastState) {
        lastState = state;
        onChange(state);
      }
    } catch (error) {
      logger.error('Error checking embedded state with Openfort', error);
    }
  };

  const intervalId: ReturnType<typeof setInterval> = setInterval(check, intervalMs);
  // Run once immediately so we don't wait for the first interval tick
  void check();

  return () => {
    stopped = true;
    clearInterval(intervalId as unknown as number);
  };
}

/**
 * Props for the OpenfortProvider component
 */
export interface OpenfortProviderProps {
  children: React.ReactNode;
  customAuth?: CustomAuthConfig;
  /**
   * Openfort application ID (can be found in openfort developer dashboard)
   */
  publishableKey: string;
  supportedChains?: [Chain, ...Chain[]];
  /**
   * Embedded signer configuration for Shield integration
   */
  walletConfig?: EmbeddedWalletConfiguration;
  /**
   * SDK overrides configuration for advanced customization
   */
  overrides?: SDKOverrides;
  /**
   * Third party auth configuration for integrating with external auth providers
   */
  thirdPartyAuth?: ThirdPartyAuthConfiguration;
  /**
   * Enable verbose logging for debugging purposes
   */
  verbose?: boolean;
}

/**
 * Main provider component that wraps the entire application and provides
 * Openfort SDK functionality through React context
 */
export const OpenfortProvider = ({
  children,
  publishableKey,
  customAuth,
  supportedChains,
  walletConfig,
  overrides,
  thirdPartyAuth,
  verbose = false,
}: OpenfortProviderProps) => {
  // Prevent multiple OpenfortProvider instances
  const existingContext = React.useContext(OpenfortContext);
  if (existingContext) {
    throw new Error(
      'Found multiple instances of OpenfortProvider. Ensure there is only one mounted in your application tree.'
    );
  }

  // Set logger verbose mode
  useEffect(() => {
    if (verbose) logger.printVerboseWarning();
    logger.setVerbose(verbose);
  }, [verbose]);

  // Create or use provided client
  const client = useMemo(() => {

    const newClient = createOpenfortClient({
      baseConfiguration: new OpenfortConfiguration({
        publishableKey: publishableKey,
      }),
      shieldConfiguration: walletConfig ? new ShieldConfiguration({
        shieldPublishableKey: walletConfig.shieldPublishableKey,
        shieldEncryptionKey: 'shieldEncryptionKey' in walletConfig ? walletConfig.shieldEncryptionKey : undefined,
        shieldDebug: walletConfig.debug,
      }) : undefined,
      overrides,
      thirdPartyAuth,
    });

    setDefaultClient(newClient);
    return newClient;
  }, [publishableKey, walletConfig, overrides]);


  // Embedded state
  const [embeddedState, setEmbeddedState] = useState<EmbeddedState>(EmbeddedState.NONE);

  // Start polling embedded state: only update and log when state changes
  useEffect(() => {
    if (!client) return;
    const stop = startEmbeddedStatePolling(client, (state) => {
      setEmbeddedState(state);
      logger.info('Current state of the embedded wallet:', getEmbeddedStateName(state));
    }, 1000);
    return stop;
  }, [client]);

  // Core state
  const [user, setUser] = useState<AuthPlayerResponse | null>(null);
  const [isUserInitialized, setIsUserInitialized] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Flow states
  const [passwordState, setPasswordState] = useState<PasswordFlowState>({ status: 'initial' });
  const [oAuthState, setOAuthState] = useState<OAuthFlowState>({ status: 'initial' });
  const [siweState, setSiweState] = useState<SiweFlowState>({ status: 'initial' });
  const [recoveryFlowState, setRecoveryFlowState] = useState<RecoveryFlowState>({ status: 'initial' });

  // OAuth provider states
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);

  // Wallet states
  const [wallets, setWallets] = useState<UserWallet[] | null>(null);
  const [activeWallet, setActiveWalletState] = useState<UserWallet | null>(null);
  const [isCreatingWallet, setIsCreatingWallet] = useState<boolean>(false);
  const [isSwitchingChain, setIsSwitchingChain] = useState<boolean>(false);

  // User state management
  const handleUserChange = useCallback((newUser: AuthPlayerResponse | null) => {
    if (newUser === null) {
      logger.info('User not authenticated. User state changed to: null');
    } else if ('id' in newUser) {
      logger.info('User authenticated. User state changed to user with id:', newUser.id);
    } else {
      logger.error('User state changed to user in wrong format:', newUser);
    }

    // Update linked providers when user changes
    const linkedAccounts = (newUser as AuthPlayerResponse).linkedAccounts || [];
    setLinkedProviders(linkedAccounts.map((acc: any) => acc.provider));

    setUser(newUser);
    if (newUser) {
      setError(null);
    }
  }, []);

  // Core methods
  const logout = useCallback(async () => {
    handleUserChange(null);
    setWallets(null);
    setActiveWalletState(null);
    setLinkedProviders([]);
    return client.auth.logout();
  }, [client, handleUserChange]);

  const getAccessToken = useCallback(async () => {
    try {
      return await client.getAccessToken();
    } catch (err) {
      logger.debug('Failed to get access token', err);
      return null;
    }
  }, [client]);

  // Wallet management functions
  const refreshWallets = useCallback(async () => {
    if (!user) {
      setWallets(null);
      setActiveWalletState(null);
      return;
    }

    try {
      const userWallets = await client.embeddedWallet.getWallets();
      setWallets(userWallets);
      
      // Set active wallet if none is set and wallets exist
      if (userWallets.length > 0 && !activeWallet) {
        setActiveWalletState(userWallets[0]);
      }
    } catch (err) {
      logger.warn('Failed to refresh wallets', err);
      setWallets([]);
    }
  }, [client, user, activeWallet]);

  // Internal refresh function for auth hooks to use
  const refreshUserState = useCallback(async (user?: AuthPlayerResponse) => {
    try {
      if (user === undefined) {
        logger.info('Refreshing user state, no user provided');
      } else if ('id' in user) {
        logger.info('Refreshing user state, user provided with id:', user.id);
      } else {
        logger.error('Refreshing user state, user provided is in wrong format:', user);
      }

      // If user is provided, use it directly instead of fetching from API
      if (user !== undefined) {
        handleUserChange(user);
        await refreshWallets();
        return user;
      }

      // Otherwise, fetch from API
      const currentUser = await client.user.get();
      logger.info('Refreshed user state', currentUser);
      handleUserChange(currentUser);
      await refreshWallets();
      return currentUser;
    } catch (err) {
      logger.warn('Failed to refresh user state', err);
      handleUserChange(null);
      setWallets(null);
      setActiveWalletState(null);
      return null;
    }
  }, [client, handleUserChange, refreshWallets]);

  // Initialize client and user
  useEffect(() => {
    if (isUserInitialized) {
      logger.info('Openfort client and user state already initialized. isUserInitialized:', isUserInitialized);
      return;
    }

    let cancelled = false;

    const initialize = async () => {
      logger.info('Initializing Openfort client and user state');

      // No explicit client initialization required
      setIsClientReady(true);

      try {
        logger.info('Refreshing user state on initial load');
        await refreshUserState();
      } catch (err) {
        // User not logged in or fetch failed; treat as unauthenticated
        handleUserChange(null);
      } finally {
        if (!cancelled) setIsUserInitialized(true);
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [client, isUserInitialized, handleUserChange, refreshUserState]);

  // Custom auth state management
  useEffect(() => {
    if (customAuth?.enabled && isUserInitialized && isClientReady) {
      (async () => {
        try {
          const { getCustomAccessToken, isLoading } = customAuth!;

          if (isLoading) return;

          const customToken = await getCustomAccessToken();

          if (customToken) {
            // Custom auth sync implementation would go here
            // This would typically handle SIWE authentication with the custom token
            logger.debug('Custom token available for authentication sync');
          }
        } catch (err) {
          logger.error('Custom auth sync failed', err);
        }
      })();
    }
  }, [client, customAuth, isUserInitialized, isClientReady]);

  // OAuth provider functions
  const isProviderLoading = useCallback((provider: OAuthProvider) => {
    return loadingProvider === provider;
  }, [loadingProvider]);

  const isProviderLinked = useCallback((provider: string) => {
    return linkedProviders.includes(provider);
  }, [linkedProviders]);

  const linkProvider = useCallback(async (provider: OAuthProvider) => {
    try {
      setLoadingProvider(provider);
      setOAuthState({ status: 'loading' });
      await client.auth.linkOauth({ provider });
      setOAuthState({ status: 'done' });
      // Refresh user state to update linked providers
      await refreshUserState();
    } catch (error) {
      logger.error('Failed to link OAuth provider', error);
      setOAuthState({ status: 'error', error: error as Error });
      setError(error as Error);
      throw error;
    } finally {
      setLoadingProvider(null);
    }
  }, [client, refreshUserState]);

  // Authentication functions
  const signUpGuest = useCallback(async () => {
    try {
      setOAuthState({ status: 'loading' });
      const result = await client.auth.signUpGuest();
      setOAuthState({ status: 'done' });
      await refreshUserState(result);
      return result;
    } catch (error) {
      logger.error('Guest signup failed', error);
      setOAuthState({ status: 'error', error: error as Error });
      setError(error as Error);
      throw error;
    }
  }, [client, refreshUserState]);

  const signInWithProvider = useCallback(async (provider: OAuthProvider, redirectUri?: string) => {
    try {
      setLoadingProvider(provider);
      setOAuthState({ status: 'loading' });
      const result = await client.auth.initOAuth({ provider, redirectUri });
      setOAuthState({ status: 'done' });
      await refreshUserState(result);
      return result;
    } catch (error) {
      logger.error('OAuth signin failed', error);
      setOAuthState({ status: 'error', error: error as Error });
      setError(error as Error);
      throw error;
    } finally {
      setLoadingProvider(null);
    }
  }, [client, refreshUserState]);

  const signOut = useCallback(async () => {
    await logout();
  }, [logout]);

  // Wallet functions
  const setActiveWallet = useCallback(async (params: { address: string; chainId: number; onSuccess?: () => void; onError?: (error: Error) => void }) => {
    const { address, chainId, onSuccess, onError } = params;
    try {
      const wallet = wallets?.find((w: UserWallet) => w.address === address);
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      await client.embeddedWallet.setActiveWallet({ address: address as `0x${string}`, chainId });
      setActiveWalletState(wallet);
      onSuccess?.();
    } catch (error) {
      logger.error('Failed to set active wallet', error);
      onError?.(error as Error);
      throw error;
    }
  }, [client, wallets]);

  const createWallet = useCallback(async (callbacks?: { onSuccess?: (wallet: UserWallet) => void; onError?: (error: Error) => void }) => {
    try {
      setIsCreatingWallet(true);
      const result = await client.embeddedWallet.createWallet();
      await refreshWallets();
      callbacks?.onSuccess?.(result.wallet);
      return result;
    } catch (error) {
      logger.error('Wallet creation failed', error);
      callbacks?.onError?.(error as Error);
      throw error;
    } finally {
      setIsCreatingWallet(false);
    }
  }, [client, refreshWallets]);

  const signMessage = useCallback(async (wallet: UserWallet, message: string): Promise<string> => {
    const provider = await wallet.getProvider();
    return await provider.request({
      method: "personal_sign",
      params: [message, wallet.address],
    });
  }, []);

  const switchChain = useCallback(async (wallet: UserWallet, chainId: string): Promise<void> => {
    setIsSwitchingChain(true);
    try {
      const provider = await wallet.getProvider();
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + Number(chainId).toString(16) }],
      });
    } finally {
      setIsSwitchingChain(false);
    }
  }, []);

  // Determine if SDK is ready
  const isReady = useMemo(() => {
    const customAuthReady = !customAuth?.enabled || !customAuth.isLoading;
    return isUserInitialized && isClientReady && customAuthReady;
  }, [isUserInitialized, isClientReady, customAuth?.enabled, customAuth?.isLoading]);

  // Computed states
  const isAuthenticating = useMemo(() => {
    return oAuthState.status === 'loading' || passwordState.status === 'loading';
  }, [oAuthState.status, passwordState.status]);

  const authError = useMemo(() => {
    return oAuthState.status === 'error' ? oAuthState.error : 
           passwordState.status === 'error' ? passwordState.error :
           error;
  }, [oAuthState, passwordState, error]);

  const isUserReady = useMemo(() => {
    return isReady && user !== null;
  }, [isReady, user]);

  const userError = useMemo(() => {
    return error;
  }, [error]);

  // Context value
  const contextValue: OpenfortContextValue = useMemo(() => ({
    client,
    user,
    isReady,
    error,
    supportedChains,
    walletConfig,
    embeddedState,

    // Flow states
    passwordState,
    oAuthState,
    siweState,
    recoveryFlowState,

    // State setters
    setPasswordState,
    setOAuthState,
    setSiweState,
    setRecoveryFlowState,

    // Core methods
    logout,
    getAccessToken,

    // OAuth provider functionality
    isProviderLoading,
    isProviderLinked,
    linkProvider,

    // Authentication functionality
    signUpGuest,
    signInWithProvider,
    isAuthenticating,
    authError,
    signOut,

    // User functionality
    isUserReady,
    userError,

    // Wallet functionality
    wallets,
    setActiveWallet,
    createWallet,
    activeWallet,
    isCreatingWallet,
    signMessage,
    switchChain,
    isSwitchingChain,

    // Internal methods
    _internal: {
      refreshUserState,
    },
  }), [
    client,
    user,
    isReady,
    error,
    supportedChains,
    walletConfig,
    embeddedState,
    passwordState,
    oAuthState,
    siweState,
    recoveryFlowState,
    logout,
    getAccessToken,
    isProviderLoading,
    isProviderLinked,
    linkProvider,
    signUpGuest,
    signInWithProvider,
    isAuthenticating,
    authError,
    signOut,
    isUserReady,
    userError,
    wallets,
    setActiveWallet,
    createWallet,
    activeWallet,
    isCreatingWallet,
    signMessage,
    switchChain,
    isSwitchingChain,
    refreshUserState,
  ]);

  // Refresh wallets when user changes
  useEffect(() => {
    if (user) {
      refreshWallets();
    }
  }, [user, refreshWallets]);

  return (
    <OpenfortContext.Provider value={contextValue}>
      {children}
      {/* Hidden WebView for embedded wallet communication */}
      {client && isReady && WebViewUtils.isSupported() && (
        <EmbeddedWalletWebView
          client={client}
          isClientReady={isReady}
          onProxyStatusChange={(status: 'loading' | 'loaded' | 'reloading') => {
            // Handle WebView status changes for debugging
            if (verbose) {
              logger.debug('WebView status changed', status);
            }
          }}
        />
      )}
    </OpenfortContext.Provider>
  );
};