import React, { useState, useEffect, useCallback, useMemo } from 'react';

import {
  AuthPlayerResponse,
  OpenfortConfiguration,
  ShieldConfiguration,
  SDKOverrides,
  EmbeddedState,
  AccountTypeEnum,
  ThirdPartyAuthConfiguration,
  Openfort as OpenfortClient,
} from '@openfort/openfort-js';

import type {
  PasswordFlowState,
  OAuthFlowState,
  SiweFlowState,
  RecoveryFlowState
} from '../types';

import { OpenfortContext, type OpenfortContextValue } from './context';
import { createOpenfortClient, setDefaultClient } from './client';
import { EmbeddedWalletWebView, WebViewUtils } from '../native';
import { logger, getEmbeddedStateName } from '../lib/logger';
import {
  DEFAULT_ENV_RULES,
  getEnvironmentStatus,
  type EnvironmentRule,
  type EnvironmentValidationOptions,
  type EnvironmentValidationResult,
} from '../lib/environmentValidation';
import { EnvironmentValidationErrorScreen } from '../components/environment/EnvironmentValidationErrorScreen';

/**
 * Custom auth configuration
 */
interface CustomAuthConfig {
  enabled: boolean;
  isLoading: boolean;
  getCustomAccessToken: () => Promise<string | null>;
}

type PolicyConfig = string | Record<number, string>;

export interface EnvironmentValidationConfig {
  /** Toggle the runtime validation behaviour. Defaults to true. */
  enabled?: boolean;
  /** Custom validation rules. Defaults to Openfort-specific requirements. */
  rules?: EnvironmentRule[];
  /** Provide an alternate lookup for configuration values. */
  getValue?: EnvironmentValidationOptions['getValue'];
  /** Control whether the default modal is displayed. Defaults to true. */
  showModal?: boolean;
  /** Render a completely custom fallback when configuration is invalid. */
  renderFallback?: (result: EnvironmentValidationResult) => React.ReactNode;
}

export type CommonEmbeddedWalletConfiguration = {
  /** Publishable key for the Shield API */
  shieldPublishableKey: string;
  /** Policy ID (pol_...) for the embedded signer */
  ethereumProviderPolicyId?: PolicyConfig;
  accountType?: AccountTypeEnum;
  debug?: boolean;
}

export type EncryptionSession =
  | {
    /** Function to retrieve an encryption session using a session ID */
    getEncryptionSession?: () => Promise<string>;
    createEncryptedSessionEndpoint?: never;
  }
  | {
    /** API endpoint for creating an encrypted session */
    createEncryptedSessionEndpoint?: string;
    getEncryptionSession?: never;
  };

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
export type EmbeddedWalletConfiguration = CommonEmbeddedWalletConfiguration & EncryptionSession

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
  /**
   * Configure how the provider validates environment variables before mounting.
   */
  environmentValidation?: EnvironmentValidationConfig;
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
  environmentValidation,
}: OpenfortProviderProps) => {
  // Prevent multiple OpenfortProvider instances
  const existingContext = React.useContext(OpenfortContext);
  if (existingContext) {
    throw new Error(
      'Found multiple instances of OpenfortProvider. Ensure there is only one mounted in your application tree.'
    );
  }

  const resolvedValidation = useMemo(() => ({
    enabled: environmentValidation?.enabled ?? true,
    rules: environmentValidation?.rules ?? DEFAULT_ENV_RULES,
    getValue: environmentValidation?.getValue,
    showModal: environmentValidation?.showModal ?? true,
    renderFallback: environmentValidation?.renderFallback,
  }), [environmentValidation]);

  // Evaluate environment readiness before initialising the Openfort client.
  const environmentStatus = useMemo<EnvironmentValidationResult>(() => {
    if (!resolvedValidation.enabled) {
      return { isValid: true, errors: [], values: {} as Record<string, string | undefined> };
    }

    return getEnvironmentStatus(resolvedValidation.rules, {
      getValue: (rule) => {
        if (resolvedValidation.getValue) {
          const customValue = resolvedValidation.getValue(rule);
          if (customValue !== undefined) {
            return customValue;
          }
        }

        switch (rule.envName) {
          case 'OPENFORT_PROJECT_PUBLISHABLE_KEY':
            return publishableKey;
          case 'OPENFORT_SHIELD_PUBLISHABLE_KEY':
            return walletConfig?.shieldPublishableKey;
          default:
            return undefined;
        }
      },
    });
  }, [resolvedValidation, publishableKey, walletConfig]);

  if (resolvedValidation.enabled && !environmentStatus.isValid) {
    if (resolvedValidation.renderFallback) {
      return resolvedValidation.renderFallback(environmentStatus);
    }

    return (
      <EnvironmentValidationErrorScreen
        errors={environmentStatus.errors}
        showModal={resolvedValidation.showModal}
      />
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

  // User state management
  const handleUserChange = useCallback((newUser: AuthPlayerResponse | null) => {
    if (newUser === null) {
      logger.info('User not authenticated. User state changed to: null');
    } else if ('id' in newUser) {
      logger.info('User authenticated. User state changed to user with id:', newUser.id);
    } else {
      logger.error('User state changed to user in wrong format:', newUser);
    }

    setUser(newUser);
    if (newUser) {
      setError(null);
    }
  }, []);

  // Core methods
  const logout = useCallback(async () => {
    handleUserChange(null);
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
        return user;
      }

      // Otherwise, fetch from API
      const currentUser = await client.user.get();
      logger.info('Refreshed user state', currentUser);
      handleUserChange(currentUser);
      return currentUser;
    } catch (err) {
      logger.warn('Failed to refresh user state', err);
      handleUserChange(null);
      return null;
    }
  }, [client, handleUserChange]);

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
        logger.error('Failed to initialize user state', err);
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

  // Determine if SDK is ready
  const isReady = useMemo(() => {
    const customAuthReady = !customAuth?.enabled || !customAuth.isLoading;
    return isUserInitialized && isClientReady && customAuthReady;
  }, [isUserInitialized, isClientReady, customAuth?.enabled, customAuth?.isLoading]);

  // Context value
  const contextValue: OpenfortContextValue = useMemo(() => ({
    client,
    user,
    isReady,
    error,
    supportedChains,
    walletConfig,
    embeddedWallet: walletConfig,
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
    refreshUserState,
  ]);

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
