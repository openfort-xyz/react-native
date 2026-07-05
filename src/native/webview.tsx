/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Openfort as OpenfortClient } from '@openfort/openfort-js'
// biome-ignore lint: need to import react
import React, { useCallback, useEffect, useRef } from 'react'
import { AppState, Platform, View } from 'react-native'
import type { WebViewMessageEvent } from 'react-native-webview'
import WebView from 'react-native-webview'
import { logger } from '../lib/logger'
import { createReloadThrottle, getRetryDelayMs } from './reloadPolicy'
import { handleSecureStorageMessage, isSecureStorageMessage } from './storage'

/**
 * Props for the EmbeddedWalletWebView component
 */
interface EmbeddedWalletWebViewProps {
  /** Openfort client instance */
  client: OpenfortClient
  /** Whether the client is ready and initialized */
  isClientReady: boolean
  /** Callback when WebView proxy status changes */
  onProxyStatusChange?: (status: 'loading' | 'loaded' | 'reloading') => void
  /** Enable WebView debugging (allows inspection via Safari/Chrome dev tools) */
  debug?: boolean
}

/**
 * WebView component for embedded wallet integration
 * Handles secure communication between React Native and the embedded wallet WebView
 * This component is hidden and only used for wallet communication
 *
 * @param props - Component props, see {@link EmbeddedWalletWebViewProps}
 */
export const EmbeddedWalletWebView: React.FC<EmbeddedWalletWebViewProps> = ({ client, onProxyStatusChange, debug }) => {
  const webViewRef = useRef<WebView>(null)

  // Consecutive load failures since the last successful load.
  const loadFailureCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Throttles health-check reloads; renderer-crash reloads bypass it because
  // the process is definitively gone.
  const shouldWatchdogReloadRef = useRef(createReloadThrottle())
  // Prevents overlapping health checks when the app foregrounds repeatedly.
  const healthCheckInFlightRef = useRef(false)

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }, [])

  const reloadWebView = useCallback(
    (reason: string) => {
      logger.warn('Reloading embedded wallet WebView:', reason)
      onProxyStatusChange?.('reloading')
      webViewRef.current?.reload()
    },
    [onProxyStatusChange]
  )

  // Handle WebView load events
  const handleLoad = useCallback(() => {
    loadFailureCountRef.current = 0
    clearRetryTimer()
    onProxyStatusChange?.('loaded')
  }, [onProxyStatusChange, clearRetryTimer])

  // Page load failures (e.g. no network at app start) are retried with
  // backoff — without a retry the wallet page would stay unloaded for the
  // rest of the session.
  const handleError = useCallback(
    (error: any) => {
      logger.error('WebView error', error)
      loadFailureCountRef.current += 1
      const attempt = loadFailureCountRef.current
      clearRetryTimer()
      retryTimerRef.current = setTimeout(() => {
        reloadWebView(`load failed, retry attempt ${attempt}`)
      }, getRetryDelayMs(attempt))
    },
    [clearRetryTimer, reloadWebView]
  )

  // The OS can reclaim the WebView's renderer process (memory pressure,
  // long backgrounding). The page goes blank and stops responding — reload
  // to restore the communication channel.
  const handleContentProcessTerminated = useCallback(() => {
    reloadWebView('content process terminated')
  }, [reloadWebView])

  const handleRenderProcessGone = useCallback(() => {
    reloadWebView('render process gone')
  }, [reloadWebView])

  const watchdogReload = useCallback(
    (reason: string) => {
      if (shouldWatchdogReloadRef.current()) {
        reloadWebView(reason)
      }
    },
    [reloadWebView]
  )

  // On returning to the foreground, verify a previously-connected wallet
  // page is still responsive; reload it if not.
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState !== 'active') return
      // Only check connections that were established — if the wallet was
      // never connected there is nothing to restore yet.
      if (!client.embeddedWallet.isReady()) return
      if (healthCheckInFlightRef.current) return
      healthCheckInFlightRef.current = true
      try {
        const responsive = await client.embeddedWallet.ping(500)
        if (!responsive) {
          watchdogReload('unresponsive after returning to foreground')
        }
      } catch (error) {
        logger.warn('Embedded wallet health check failed', error)
      } finally {
        healthCheckInFlightRef.current = false
      }
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange)
    return () => subscription?.remove()
  }, [client, watchdogReload])

  // React to connection-health events from the SDK: an RPC or handshake
  // timeout means the page is unresponsive and a reload restores it. An
  // 'iframe-reloaded' event means the transport already recovered on its
  // own, so no action is needed. Older SDK versions don't emit this event;
  // the subscription is simply inert there.
  useEffect(() => {
    const handleConnectionLost = (payload: { reason?: string }) => {
      if (payload?.reason === 'iframe-reloaded') return
      watchdogReload(`connection lost (${payload?.reason ?? 'unknown'})`)
    }

    client.eventEmitter.on('onEmbeddedWalletConnectionLost', handleConnectionLost)
    return () => {
      client.eventEmitter.off('onEmbeddedWalletConnectionLost', handleConnectionLost)
    }
  }, [client, watchdogReload])

  // Clear any pending retry timer on unmount.
  useEffect(() => clearRetryTimer, [clearRetryTimer])

  // Clean message handler using the new penpal bridge
  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const messageData = JSON.parse(event?.nativeEvent?.data)
        if (!messageData) return

        // Handle secure storage messages
        if (isSecureStorageMessage(messageData)) {
          const response = await handleSecureStorageMessage(messageData)
          webViewRef.current?.postMessage(JSON.stringify(response))
          return
        }
        // Forward all messages to the embedded wallet
        client.embeddedWallet.onMessage(messageData)
      } catch (error) {
        logger.error('Failed to handle WebView message', error)
        // Don't crash the app on message handling errors
      }
    },
    [client]
  )

  // Ref callback to set up message poster immediately
  const handleWebViewRef = useCallback(
    (ref: WebView | null) => {
      if (webViewRef.current !== ref) {
        ;(webViewRef as React.MutableRefObject<WebView | null>).current = ref
      }
      if (ref) {
        const messagePoster = {
          postMessage: (message: string) => {
            ref.postMessage(message)
          },
        }
        client.embeddedWallet.setMessagePoster(messagePoster)
      }
    },
    [client]
  )

  return (
    <View style={{ width: 0, height: 0, overflow: 'hidden' }}>
      <WebView
        ref={handleWebViewRef}
        source={{
          uri: client.embeddedWallet.getURL(),
        }}
        // Enable debugging when explicitly enabled via walletConfig.debug
        webviewDebuggingEnabled={debug}
        cacheEnabled={false}
        injectedJavaScriptObject={{ shouldUseAppBackedStorage: true }}
        cacheMode="LOAD_NO_CACHE"
        onLoad={handleLoad}
        onError={handleError}
        onMessage={handleMessage}
        onContentProcessDidTerminate={handleContentProcessTerminated}
        onRenderProcessGone={handleRenderProcessGone}
      />
    </View>
  )
}

/**
 * Utilities for WebView integration
 */
export const WebViewUtils = {
  /**
   * Checks if WebView is supported on the current platform
   *
   * @returns True if the platform is iOS or Android, false otherwise
   */
  isSupported(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android'
  },

  /**
   * Gets platform-specific WebView configuration
   *
   * @returns Platform-specific WebView configuration object
   */
  getPlatformConfig(): Partial<React.ComponentProps<typeof WebView>> {
    if (Platform.OS === 'ios') {
      return {
        allowsInlineMediaPlayback: false,
        allowsLinkPreview: false,
        bounces: false,
      }
    }

    if (Platform.OS === 'android') {
      return {
        domStorageEnabled: false,
        javaScriptCanOpenWindowsAutomatically: false,
        mixedContentMode: 'never',
      }
    }

    return {}
  },

  /**
   * Creates a secure message for WebView communication
   *
   * @param data - Data to include in the message
   * @returns JSON-stringified message with timestamp and platform information
   */
  createSecureMessage(data: any): string {
    return JSON.stringify({
      timestamp: Date.now(),
      platform: Platform.OS,
      data,
    })
  },

  /**
   * Validates a message received from WebView
   *
   * @param message - JSON string message to validate
   * @returns Validation result with parsed data or error information
   */
  validateMessage(message: string): {
    isValid: boolean
    data?: any
    error?: string
  } {
    try {
      const parsed = JSON.parse(message)

      // Basic validation
      if (typeof parsed !== 'object' || parsed === null) {
        return { isValid: false, error: 'Invalid message format' }
      }

      return { isValid: true, data: parsed }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Failed to parse message',
      }
    }
  },

  /**
   * Gets WebView user agent for the current platform
   *
   * @returns User agent string including platform and version information
   */
  getUserAgent(): string {
    const baseAgent = 'OpenfortEmbeddedWallet/1.0'
    return `${baseAgent} (${Platform.OS}; ${Platform.Version})`
  },
}
