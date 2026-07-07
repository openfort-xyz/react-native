/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Openfort as OpenfortClient } from '@openfort/openfort-js'
// biome-ignore lint: need to import react
import React, { useCallback, useEffect, useRef } from 'react'
import { AppState, Platform, View } from 'react-native'
import type { WebViewMessageEvent } from 'react-native-webview'
import WebView from 'react-native-webview'
import { logger } from '../lib/logger'
import {
  createCrashBackoff,
  createPendingCallTracker,
  createReloadThrottle,
  getPenpalMessageId,
  getRetryDelayMs,
} from './reloadPolicy'
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
  // Throttles health-check and connection-lost reloads, escalating while
  // reloads fire back-to-back so a permanently broken page isn't hammered.
  const shouldWatchdogReloadRef = useRef(createReloadThrottle())
  // Rate-limits renderer-crash reloads: the first crash reloads immediately,
  // but a renderer that dies on every load (e.g. page OOM on a low-memory
  // device) backs off instead of crash-looping.
  const crashBackoffRef = useRef(createCrashBackoff())
  // Penpal calls currently crossing the bridge — a reload silently abandons
  // them, so reload triggers consult this before acting.
  const pendingCallsRef = useRef(createPendingCallTracker())
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
      if (pendingCallsRef.current.hasPendingCalls()) {
        // Make the drop visible: these RPCs will only settle through the
        // SDK's own per-call timeout.
        logger.warn('Reloading embedded wallet WebView with wallet operations in flight — they will be abandoned')
      }
      pendingCallsRef.current.clear()
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
  // to restore the communication channel. The first crash reloads
  // immediately; repeated crashes back off so a page that dies on every
  // load can't pin the device in a crash→reload loop.
  const handleRendererCrash = useCallback(
    (reason: string) => {
      // The process is gone — whatever was in flight is already lost.
      pendingCallsRef.current.clear()
      const delayMs = crashBackoffRef.current()
      if (delayMs === 0) {
        reloadWebView(reason)
        return
      }
      logger.warn(`Embedded wallet WebView renderer crashed again (${reason}), reloading in ${delayMs}ms`)
      clearRetryTimer()
      retryTimerRef.current = setTimeout(() => {
        reloadWebView(`${reason} (after ${delayMs}ms backoff)`)
      }, delayMs)
    },
    [reloadWebView, clearRetryTimer]
  )

  const handleContentProcessTerminated = useCallback(() => {
    handleRendererCrash('content process terminated')
  }, [handleRendererCrash])

  const handleRenderProcessGone = useCallback(() => {
    handleRendererCrash('render process gone')
  }, [handleRendererCrash])

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
      // A wallet operation is mid-flight (e.g. a sign whose biometric prompt
      // backgrounded the app). Probing now could misread a busy page as dead
      // and reload it out from under the operation; if the page really is
      // stuck, the SDK's per-call timeout fires the connection-lost event
      // and recovery happens through that path instead.
      if (pendingCallsRef.current.hasPendingCalls()) return
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
      // The SDK has already torn the transport down and settled in-flight
      // calls with typed errors — no replies will arrive for them, so drop
      // the tracker entries rather than letting them suppress health checks
      // until they age out.
      pendingCallsRef.current.clear()
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
        // A reply settles its in-flight call (see the pending-call tracker).
        const replyId = getPenpalMessageId(messageData, 'reply')
        if (replyId !== null) {
          pendingCallsRef.current.callSettled(replyId)
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
            // Track outgoing penpal calls so reload triggers know a wallet
            // operation is crossing the bridge (a reload would abandon it).
            try {
              const callId = getPenpalMessageId(JSON.parse(message), 'call')
              if (callId !== null) {
                pendingCallsRef.current.callStarted(callId)
              }
            } catch {
              // Non-JSON payloads are not penpal calls; post them unchanged.
            }
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
