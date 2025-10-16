/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Openfort as OpenfortClient } from '@openfort/openfort-js'
import React, { useCallback, useEffect, useRef } from 'react'
import { AppState, Platform, View } from 'react-native'
import type { WebViewMessageEvent } from 'react-native-webview'
import WebView from 'react-native-webview'
import { logger } from '../lib/logger'
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
}

/**
 * WebView component for embedded wallet integration
 * Handles secure communication between React Native and the embedded wallet WebView
 * This component is hidden and only used for wallet communication
 */
export const EmbeddedWalletWebView: React.FC<EmbeddedWalletWebViewProps> = ({
  client,
  isClientReady: _isClientReady,
  onProxyStatusChange,
}) => {
  const webViewRef = useRef<WebView>(null)

  // Handle app state changes to monitor WebView health
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Check if embedded wallet is still responsive
        try {
          await client.embeddedWallet.ping(500)
          // if (!isResponsive) {
          //   onProxyStatusChange?.('reloading');
          //   // client.embeddedWallet.reload();
          // }
        } catch (error) {
          logger.warn('Failed to ping embedded wallet', error)
        }
      }
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange)
    return () => subscription?.remove()
  }, [client])

  // Handle WebView load events
  const handleLoad = useCallback(() => {
    onProxyStatusChange?.('loaded')
  }, [onProxyStatusChange])

  const handleError = useCallback((error: any) => {
    logger.error('WebView error', error)
  }, [])

  // Set up WebView reference with client immediately when both are available
  useEffect(() => {
    if (webViewRef.current) {
      // Simple message poster that uses WebView's postMessage directly
      const messagePoster = {
        postMessage: (message: string) => {
          webViewRef.current?.postMessage(message)
        },
      }
      client.embeddedWallet.setMessagePoster(messagePoster)
    }
  }, [client])

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
        webviewDebuggingEnabled={true}
        cacheEnabled={false}
        injectedJavaScriptObject={{ shouldUseAppBackedStorage: true }}
        cacheMode="LOAD_NO_CACHE"
        onLoad={handleLoad}
        onError={handleError}
        onMessage={handleMessage}
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
   */
  isSupported(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android'
  },

  /**
   * Gets platform-specific WebView configuration
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
   */
  validateMessage(message: string): { isValid: boolean; data?: any; error?: string } {
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
   */
  getUserAgent(): string {
    const baseAgent = 'OpenfortEmbeddedWallet/1.0'
    return `${baseAgent} (${Platform.OS}; ${Platform.Version})`
  },
}
