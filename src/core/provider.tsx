import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { OpenfortConfiguration, ShieldConfiguration, RecoveryMethod, SDKOverrides, EmbeddedState } from '@openfort/openfort-js';
import { OpenfortContext, type OpenfortContextValue } from './context';
import { createOpenfortClient, setDefaultClient } from './client';

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
type Chain = {
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
  embeddedWallet?: EmbeddedWalletConfiguration;
  /**
   * SDK overrides configuration for advanced customization
   */
  overrides?: SDKOverrides;
}

/**
 * Main provider component that wraps the entire application and provides
 * Openfort SDK functionality through React context
 */
export const OpenfortProvider: React.FC<OpenfortProviderProps> = ({
  children,
  publishableKey,
  customAuth,
  supportedChains,
  embeddedWallet,
  overrides,
}) => {
  // Prevent multiple OpenfortProvider instances
  const existingContext = React.useContext(OpenfortContext);
  if (existingContext) {
    throw new Error(
      'Found multiple instances of OpenfortProvider. Ensure there is only one mounted in your application tree.'
    );
  }

  // Create or use provided client
  const client = useMemo(() => {

    const newClient = createOpenfortClient({
      baseConfiguration: new OpenfortConfiguration({
        publishableKey: publishableKey,
      }),
      shieldConfiguration: embeddedWallet ? new ShieldConfiguration({
        shieldPublishableKey: embeddedWallet.shieldPublishableKey,
        shieldEncryptionKey: 'shieldEncryptionKey' in embeddedWallet ? embeddedWallet.shieldEncryptionKey : undefined,
        shieldDebug: embeddedWallet.debug,
      }) : undefined,
      overrides: {
        ...overrides,
      },
    });
    
    setDefaultClient(newClient);
    return newClient;
  }, [publishableKey, embeddedWallet, overrides]);


  // Embedded state
  const [embeddedState, setEmbeddedState] = useState<EmbeddedState>(EmbeddedState.NONE);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const pollEmbeddedState = useCallback(async () => {
    if (!client) return;

    try {
      const state = await client.embeddedWallet.getEmbeddedState();
      setEmbeddedState(state);
    } catch (error) {
      console.error('Error checking embedded state with Openfort:', error);
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
  }, [client]);

  const startPollingEmbeddedState = useCallback(() => {

    if (!!pollingRef.current) return;
    pollingRef.current = setInterval(pollEmbeddedState, 300);
  }, [pollEmbeddedState]);

  const stopPollingEmbeddedState = useCallback(() => {
    clearInterval(pollingRef.current || undefined);
    pollingRef.current = null;
  }, []);

  useEffect(() => {
    if (!client) return;

    startPollingEmbeddedState();

    return () => {
      stopPollingEmbeddedState();
    };
  }, [client]);

  // Core state
  const [user, setUser] = useState<import('@openfort/openfort-js').AuthPlayerResponse | null>(null);
  const [isUserInitialized, setIsUserInitialized] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // User state management
  const handleUserChange = useCallback((newUser: import('@openfort/openfort-js').AuthPlayerResponse | null) => {
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
      console.debug('Failed to get access token:', err);
      return null;
    }
  }, [client]);

  // Initialize client and user
  useEffect(() => {
    if (!isUserInitialized) {
      (async () => {
        try {
          // Openfort client doesn't need explicit initialization
          setIsClientReady(true);
        } catch (err) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }

        try {
          const currentUser = await client.user.get();
          handleUserChange(currentUser);
        } catch (err) {
          // User not logged in, which is fine
          handleUserChange(null);
        } finally {
          setIsUserInitialized(true);
        }
      })();
    }
  }, [client, isUserInitialized]);


  // Custom auth state management
  useEffect(() => {
    if (customAuth?.enabled && isUserInitialized && isClientReady) {
      (async () => {
        try {
          const { getCustomAccessToken, isLoading } = customAuth!;
          
          if (isLoading) return;

          const customToken = await getCustomAccessToken();
          
          if (customToken) {
            // TODO: Implement custom auth sync
            // This would need proper SIWE parameters
            console.debug('Custom token available, but SIWE sync not implemented yet');
          }
        } catch (err) {
          console.error('Custom auth sync failed:', err);
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
    
    // Core methods
    logout,
    getAccessToken,
  }), [
    client,
    user,
    isReady,
    error,
    logout,
    getAccessToken,
  ]);

  return (
    <OpenfortContext.Provider value={contextValue}>
      {children}
    </OpenfortContext.Provider>
  );
};