import {
  type AccountTypeEnum,
  type AuthPlayerResponse,
  EmbeddedState,
  type Openfort as OpenfortClient,
  type SDKOverrides,
  ShieldConfiguration,
  type ThirdPartyAuthConfiguration,
} from '@openfort/openfort-js'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { validateEnvironment } from '../lib/environmentValidation'
import { getEmbeddedStateName, logger } from '../lib/logger'
import { EmbeddedWalletWebView, WebViewUtils } from '../native'
import type { OAuthFlowState, PasswordFlowState, RecoveryFlowState, SiweFlowState } from '../types'
import { createOpenfortClient, setDefaultClient } from './client'
import { OpenfortContext, type OpenfortContextValue } from './context'

type PolicyConfig = string | Record<number, string>

export type CommonEmbeddedWalletConfiguration = {
  /** Publishable key for the Shield API. */
  shieldPublishableKey: string
  /** Policy ID (pol_...) for the embedded signer. */
  ethereumProviderPolicyId?: PolicyConfig
  accountType?: AccountTypeEnum
  debug?: boolean
  /** Recovery method for the embedded wallet: 'automatic' or 'password' */
  recoveryMethod?: 'automatic' | 'password'
}

export type EncryptionSession =
  | {
      /** Function to retrieve an encryption session using a session ID */
      getEncryptionSession?: () => Promise<string>
      createEncryptedSessionEndpoint?: never
    }
  | {
      /** API endpoint for creating an encrypted session */
      createEncryptedSessionEndpoint?: string
      getEncryptionSession?: never
    }

/**
 * Configuration for enabling embedded wallet recovery flows.
 *
 * Automatic recovery requires an encryption session, while password-based recovery may either use
 * an encryption session or a Shield encryption key. Provide a
 * {@link EncryptionSession.getEncryptionSession | getEncryptionSession} callback to surface the
 * session identifier. TODO: add support for `createEncryptedSessionEndpoint` once the native
 * hooks implement that pathway.
 */
export type EmbeddedWalletConfiguration = CommonEmbeddedWalletConfiguration & EncryptionSession

/**
 * These types are fully compatible with WAGMI chain types, in case
 * we need interop in the future.
 */
type RpcUrls = {
  http: readonly string[]
  webSocket?: readonly string[]
}
type NativeCurrency = {
  name: string
  /** 2-6 characters long. */
  symbol: string
  decimals: number
}
type BlockExplorer = {
  name: string
  url: string
}
/**
 * A subset of WAGMI's chain type.
 *
 * https://github.com/wagmi-dev/references/blob/6aea7ee9c65cfac24f33173ab3c98176b8366f05/packages/chains/src/types.ts#L8
 */
export type Chain = {
  /** Chain identifier in number form. */
  id: number
  /** Human readable name. */
  name: string
  /** Internal network name. */
  network?: string
  /** Currency used by chain. */
  nativeCurrency: NativeCurrency
  /** Collection of block explorers. */
  blockExplorers?: {
    [key: string]: BlockExplorer
    default: BlockExplorer
  }
  /** Collection of RPC endpoints. */
  rpcUrls: {
    [key: string]: RpcUrls
    default: RpcUrls
  }
  /** Flag for test networks. */
  testnet?: boolean
}

/**
 * Starts polling the embedded wallet state and invokes the callback when transitions occur.
 *
 * @param client - The Openfort client to query for embedded wallet state.
 * @param onChange - Callback invoked whenever the state changes.
 * @param intervalMs - Polling interval in milliseconds. Defaults to 1000ms.
 * @returns A function that stops polling when called.
 */
function startEmbeddedStatePolling(
  client: OpenfortClient,
  onChange: (state: EmbeddedState) => void,
  intervalMs: number = 1000
): () => void {
  let lastState: EmbeddedState | null = null
  let stopped = false

  const check = async () => {
    if (stopped) return
    try {
      const state = await client.embeddedWallet.getEmbeddedState()
      if (state !== lastState) {
        lastState = state
        onChange(state)
      }
    } catch (error) {
      logger.error('Error checking embedded state with Openfort', error)
    }
  }

  const intervalId: ReturnType<typeof setInterval> = setInterval(check, intervalMs)
  // Run once immediately so we don't wait for the first interval tick
  void check()

  return () => {
    stopped = true
    clearInterval(intervalId as unknown as number)
  }
}

/**
 * Props for the {@link OpenfortProvider} component.
 */
export interface OpenfortProviderProps {
  children: React.ReactNode
  /**
   * Openfort application ID (can be found in the Openfort developer dashboard).
   */
  publishableKey: string
  supportedChains?: [Chain, ...Chain[]]
  /**
   * Embedded signer configuration for Shield integration.
   */
  walletConfig?: EmbeddedWalletConfiguration
  /**
   * SDK overrides configuration for advanced customization.
   */
  overrides?: SDKOverrides
  /**
   * Third party auth configuration for integrating with external auth providers.
   */
  thirdPartyAuth?: ThirdPartyAuthConfiguration
  /**
   * Enable verbose logging for debugging purposes.
   */
  verbose?: boolean
}

/**
 * Provider component that initialises the Openfort SDK and exposes its state via {@link OpenfortContext}
 *
 * This component must wrap your React Native app to provide Openfort functionality to all child components.
 * It initializes the SDK with the provided configuration and manages authentication state.
 *
 * @param props - Provider configuration including the publishable key and optional overrides
 * @returns A React element that provides the Openfort context to its children
 *
 * @example
 * ```tsx
 * import { OpenfortProvider } from '@openfort/react-native';
 * import { polygon, polygonMumbai } from 'viem/chains';
 *
 * function App() {
 *   return (
 *     <OpenfortProvider
 *       publishableKey="pk_test_..."
 *       supportedChains={[polygon, polygonMumbai]}
 *       walletConfig={{
 *         shieldPublishableKey: "shield_pk_...",
 *         getEncryptionSession: () => fetchEncryptionSession(),
 *       }}
 *       verbose={true}
 *     >
 *       <YourAppContent />
 *     </OpenfortProvider>
 *   );
 * }
 * ```
 */
export const OpenfortProvider = ({
  children,
  publishableKey,
  supportedChains,
  walletConfig,
  overrides,
  thirdPartyAuth,
  verbose = false,
}: OpenfortProviderProps) => {
  // Validate environment variables before anything else
  validateEnvironment({
    publishableKey,
    shieldPublishableKey: walletConfig?.shieldPublishableKey,
  })

  // Prevent multiple OpenfortProvider instances
  const existingContext = React.useContext(OpenfortContext)
  if (existingContext) {
    throw new Error(
      'Found multiple instances of OpenfortProvider. Ensure there is only one mounted in your application tree.'
    )
  }

  // Set logger verbose mode
  useEffect(() => {
    if (verbose) logger.printVerboseWarning()
    logger.setVerbose(verbose)
  }, [verbose])

  // Create or use provided client
  const client = useMemo(() => {
    const newClient = createOpenfortClient({
      baseConfiguration: {
        publishableKey: publishableKey,
      },
      shieldConfiguration: walletConfig
        ? new ShieldConfiguration({
            shieldPublishableKey: walletConfig.shieldPublishableKey,
            shieldDebug: walletConfig.debug,
          })
        : undefined,
      overrides,
      thirdPartyAuth,
    })

    setDefaultClient(newClient)
    return newClient
  }, [publishableKey, walletConfig, overrides])

  // Embedded state
  const [embeddedState, setEmbeddedState] = useState<EmbeddedState>(EmbeddedState.NONE)

  // Start polling embedded state: only update and log when state changes
  useEffect(() => {
    if (!client) return
    const stop = startEmbeddedStatePolling(
      client,
      (state) => {
        setEmbeddedState(state)
        logger.info('Current state of the embedded wallet:', getEmbeddedStateName(state))
      },
      1000
    )
    return stop
  }, [client])

  // Core state
  const [user, setUser] = useState<AuthPlayerResponse | null>(null)
  const [isUserInitialized, setIsUserInitialized] = useState(false)
  const [isClientReady, setIsClientReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Flow states
  const [passwordState, setPasswordState] = useState<PasswordFlowState>({ status: 'initial' })
  const [oAuthState, setOAuthState] = useState<OAuthFlowState>({ status: 'initial' })
  const [siweState, setSiweState] = useState<SiweFlowState>({ status: 'initial' })
  const [recoveryFlowState, setRecoveryFlowState] = useState<RecoveryFlowState>({ status: 'initial' })

  // User state management
  const handleUserChange = useCallback((newUser: AuthPlayerResponse | null) => {
    if (newUser === null) {
      logger.info('User not authenticated. User state changed to: null')
    } else if ('id' in newUser) {
      logger.info('User authenticated. User state changed to user with id:', newUser.id)
    } else {
      logger.error('User state changed to user in wrong format:', newUser)
    }

    setUser(newUser)
    if (newUser) {
      setError(null)
    }
  }, [])

  // Core methods
  const logout = useCallback(async () => {
    handleUserChange(null)
    return client.auth.logout()
  }, [client, handleUserChange])

  const getAccessToken = useCallback(async () => {
    try {
      return await client.getAccessToken()
    } catch (err) {
      logger.debug('Failed to get access token', err)
      return null
    }
  }, [client])

  // Internal refresh function for auth hooks to use
  const refreshUserState = useCallback(
    async (user?: AuthPlayerResponse) => {
      try {
        if (user === undefined) {
          logger.info('Refreshing user state, no user provided')
        } else if ('id' in user) {
          logger.info('Refreshing user state, user provided with id:', user.id)
        } else {
          logger.error('Refreshing user state, user provided is in wrong format:', user)
        }

        // If user is provided, use it directly instead of fetching from API
        if (user !== undefined) {
          handleUserChange(user)
          return user
        }

        // Otherwise, fetch from API
        const currentUser = await client.user.get()
        logger.info('Refreshed user state', currentUser)
        handleUserChange(currentUser)
        return currentUser
      } catch (err) {
        logger.warn('Failed to refresh user state', err)
        handleUserChange(null)
        return null
      }
    },
    [client, handleUserChange]
  )

  // Initialize client and user
  useEffect(() => {
    if (isUserInitialized) {
      logger.info('Openfort client and user state already initialized. isUserInitialized:', isUserInitialized)
      return
    }

    let cancelled = false

    const initialize = async () => {
      logger.info('Initializing Openfort client and user state')

      // No explicit client initialization required
      setIsClientReady(true)

      try {
        logger.info('Refreshing user state on initial load')
        await refreshUserState()
      } catch (err) {
        logger.error('Failed to initialize user state', err)
        // User not logged in or fetch failed; treat as unauthenticated
        handleUserChange(null)
      } finally {
        if (!cancelled) setIsUserInitialized(true)
      }
    }

    void initialize()

    return () => {
      cancelled = true
    }
  }, [client, isUserInitialized, handleUserChange, refreshUserState])

  // Determine if SDK is ready
  const isReady = useMemo(() => {
    return isUserInitialized && isClientReady
  }, [isUserInitialized, isClientReady])

  // Context value
  const contextValue: OpenfortContextValue = useMemo(
    () => ({
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
    }),
    [
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
    ]
  )

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
              logger.debug('WebView status changed', status)
            }
          }}
        />
      )}
    </OpenfortContext.Provider>
  )
}
