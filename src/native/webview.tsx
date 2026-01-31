/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Openfort as OpenfortClient } from '@openfort/openfort-js'
// biome-ignore lint: need to import react
import React, { useCallback, useEffect, useRef } from 'react'
import { AppState, Platform, View } from 'react-native'
import type { WebViewMessageEvent } from 'react-native-webview'
import WebView from 'react-native-webview'
import { logger } from '../lib/logger'
import { handleSecureStorageMessage, isSecureStorageMessage } from './storage'

/**
 * Converts a number array to a base64 string.
 * Used to transform passkey keys that have been serialized via JSON.stringify
 * (which converts Uint8Array to number[]) into a format that the Shield iframe's
 * ensurePasskeyKeyBuffer() can handle.
 *
 * @param arr - Array of numbers representing bytes
 * @returns Base64-encoded string
 */
function numberArrayToBase64(arr: number[]): string {
  return btoa(String.fromCharCode(...arr))
}

/**
 * Transforms passkey key data in penpal messages from number[] to base64 string.
 * This is necessary because:
 * 1. NativePasskeyHandler returns key as Uint8Array
 * 2. JSON.stringify converts Uint8Array to number[]
 * 3. Shield iframe's crypto.subtle.importKey requires BufferSource, not number[]
 * 4. Shield's ensurePasskeyKeyBuffer() handles base64 strings correctly
 *
 * @param messageJson - JSON string of the penpal message
 * @returns Transformed JSON string with passkey keys as base64
 */
function transformPasskeyKeyToBase64(messageJson: string): string {
  try {
    const message = JSON.parse(messageJson)

    // Only transform penpal 'call' messages
    if (message?.penpal !== 'call') {
      return messageJson
    }

    const methodName = message.methodName
    const args = message.args

    if (!args || !Array.isArray(args) || args.length === 0) {
      return messageJson
    }

    let modified = false

    // Handle create and recover methods: passkey.key
    if ((methodName === 'create' || methodName === 'recover') && args[0]?.passkey?.key) {
      const key = args[0].passkey.key
      if (Array.isArray(key) && key.length > 0 && typeof key[0] === 'number') {
        args[0].passkey.key = numberArrayToBase64(key)
        modified = true
        if (__DEV__) {
          logger.debug(`[WebView] Transformed passkey.key to base64 for ${methodName}`)
        }
      }
    }

    // Handle setRecoveryMethod: passkeyKey
    if (methodName === 'setRecoveryMethod' && args[0]?.passkeyKey) {
      const key = args[0].passkeyKey
      if (Array.isArray(key) && key.length > 0 && typeof key[0] === 'number') {
        args[0].passkeyKey = numberArrayToBase64(key)
        modified = true
        if (__DEV__) {
          logger.debug('[WebView] Transformed passkeyKey to base64 for setRecoveryMethod')
        }
      }
    }

    if (modified) {
      return JSON.stringify(message)
    }

    return messageJson
  } catch {
    // If parsing fails, return original message
    return messageJson
  }
}

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
 *
 * @param props - Component props, see {@link EmbeddedWalletWebViewProps}
 */
export const EmbeddedWalletWebView: React.FC<EmbeddedWalletWebViewProps> = ({
  client,
  isClientReady,
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
  }, [client, onProxyStatusChange])

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
      // Message poster with passkey key transformation for React Native
      // Converts number[] keys to base64 strings before sending to Shield iframe
      const messagePoster = {
        postMessage: (message: string) => {
          const transformed = transformPasskeyKeyToBase64(message)
          webViewRef.current?.postMessage(transformed)
        },
      }
      client.embeddedWallet.setMessagePoster(messagePoster)
    }
  }, [client, isClientReady])

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
        // Message poster with passkey key transformation for React Native
        // Converts number[] keys to base64 strings before sending to Shield iframe
        const messagePoster = {
          postMessage: (message: string) => {
            const transformed = transformPasskeyKeyToBase64(message)
            ref.postMessage(transformed)
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
   *
   * @returns User agent string including platform and version information
   */
  getUserAgent(): string {
    const baseAgent = 'OpenfortEmbeddedWallet/1.0'
    return `${baseAgent} (${Platform.OS}; ${Platform.Version})`
  },
}
