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
 * Checks if a value is an object with numeric values (serialized Uint8Array).
 * In some React Native environments, Uint8Array serializes as {0: n, 1: n, ...}
 * instead of [n, n, ...].
 *
 * @param obj - Value to check
 * @returns True if obj is a plain object with numeric values
 */
function isObjectWithNumericValues(obj: unknown): obj is Record<string, number> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false
  }
  const keys = Object.keys(obj)
  if (keys.length === 0) {
    return false
  }
  // Check if all values are numbers
  return Object.values(obj).every((v) => typeof v === 'number')
}

/**
 * Converts a key (either number[] or {0: n, 1: n, ...}) to a number array.
 *
 * @param key - The key to convert
 * @returns Number array or null if conversion not possible
 */
function keyToNumberArray(key: unknown): number[] | null {
  if (Array.isArray(key) && key.length > 0 && typeof key[0] === 'number') {
    return key
  }
  if (isObjectWithNumericValues(key)) {
    // Convert object {0: n, 1: n, ...} to array [n, n, ...]
    // Sort by numeric key to ensure correct order
    const numericKeys = Object.keys(key)
      .map(Number)
      .sort((a, b) => a - b)
    return numericKeys.map((k) => (key as Record<string, number>)[String(k)])
  }
  return null
}

/**
 * Ensures passkey key data in penpal messages is a proper number[] array.
 * This is necessary because:
 * 1. NativePasskeyHandler returns key as Uint8Array
 * 2. JSON.stringify may convert Uint8Array to {0:n, 1:n, ...} (object) instead of [n,n,...] (array)
 * 3. Shield iframe does new Uint8Array(key) which works with number[] but not with object format
 *
 * @param messageJson - JSON string of the penpal message
 * @returns Transformed JSON string with passkey keys as number[]
 */
function ensurePasskeyKeyIsArray(messageJson: string): string {
  try {
    const message = JSON.parse(messageJson)

    // Log all penpal messages to see what's coming through
    if (message?.penpal) {
      console.log('[WebView Transform] penpal message:', message.penpal, 'methodName:', message.methodName)
    }

    // Only transform penpal 'call' messages
    if (message?.penpal !== 'call') {
      return messageJson
    }

    const methodName = message.methodName
    const args = message.args

    console.log('[WebView Transform] call message:', methodName, 'has args:', !!args, 'args length:', args?.length)

    if (!args || !Array.isArray(args) || args.length === 0) {
      console.log('[WebView Transform] No args or empty args, skipping')
      return messageJson
    }

    // Log what we're looking for
    console.log('[WebView Transform] args[0].passkey:', !!args[0]?.passkey)
    if (args[0]?.passkey) {
      console.log('[WebView Transform] args[0].passkey.key exists:', !!args[0].passkey.key)
      console.log('[WebView Transform] args[0].passkey.key type:', typeof args[0].passkey.key, 'isArray:', Array.isArray(args[0].passkey.key))
      if (Array.isArray(args[0].passkey.key)) {
        console.log('[WebView Transform] args[0].passkey.key length:', args[0].passkey.key.length, 'first element type:', typeof args[0].passkey.key[0])
      }
    }
    console.log('[WebView Transform] args[0].passkeyKey exists:', !!args[0]?.passkeyKey)

    let modified = false

    // Handle create and recover methods: passkey.key
    if ((methodName === 'create' || methodName === 'recover') && args[0]?.passkey?.key) {
      const key = args[0].passkey.key
      const isArray = Array.isArray(key)
      const isObject = isObjectWithNumericValues(key)
      console.log('[WebView Transform] Found passkey.key for', methodName, 'isArray:', isArray, 'isObjectWithNumericValues:', isObject, 'length:', key?.length || Object.keys(key || {}).length)
      
      // If already a proper array, no transformation needed
      if (isArray) {
        console.log('[WebView Transform] ✅ passkey.key is already a number[], no transformation needed')
      } else if (isObject) {
        // Convert object {0: n, 1: n, ...} to array [n, n, ...]
        const numberArray = keyToNumberArray(key)
        if (numberArray) {
          args[0].passkey.key = numberArray
          modified = true
          console.log('[WebView Transform] ✅ TRANSFORMED passkey.key from object to number[] for', methodName, 'length:', numberArray.length)
        }
      } else {
        console.log('[WebView Transform] ⚠️ passkey.key is not a number array or object, skipping transformation')
      }
    }

    // Handle setRecoveryMethod: passkeyKey
    if (methodName === 'setRecoveryMethod' && args[0]?.passkeyKey) {
      const key = args[0].passkeyKey
      const isArray = Array.isArray(key)
      const isObject = isObjectWithNumericValues(key)
      console.log('[WebView Transform] Found passkeyKey for setRecoveryMethod, isArray:', isArray, 'isObjectWithNumericValues:', isObject, 'length:', key?.length || Object.keys(key || {}).length)
      
      // If already a proper array, no transformation needed
      if (isArray) {
        console.log('[WebView Transform] ✅ passkeyKey is already a number[], no transformation needed')
      } else if (isObject) {
        // Convert object {0: n, 1: n, ...} to array [n, n, ...]
        const numberArray = keyToNumberArray(key)
        if (numberArray) {
          args[0].passkeyKey = numberArray
          modified = true
          console.log('[WebView Transform] ✅ TRANSFORMED passkeyKey from object to number[] for setRecoveryMethod, length:', numberArray.length)
        }
      } else {
        console.log('[WebView Transform] ⚠️ passkeyKey is not a number array or object, skipping transformation')
      }
    }

    if (modified) {
      console.log('[WebView Transform] Message modified, returning transformed JSON')
      return JSON.stringify(message)
    }

    console.log('[WebView Transform] No modifications needed, returning original message')
    return messageJson
  } catch (error) {
    // If parsing fails, return original message
    console.log('[WebView Transform] ❌ Error parsing/transforming message:', error)
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
      // Ensures passkey keys are proper number[] arrays before sending to Shield iframe
      const messagePoster = {
        postMessage: (message: string) => {
          console.log('[WebView] postMessage called via useEffect')
          const transformed = ensurePasskeyKeyIsArray(message)
          // Debug: Log full outgoing message for passkey-related calls
          try {
            const parsed = JSON.parse(transformed)
            if (parsed?.methodName === 'create' || parsed?.methodName === 'recover' || parsed?.methodName === 'setRecoveryMethod') {
              console.log('[WebView DEBUG] 📤 OUTGOING REQUEST:', parsed.methodName)
              console.log('[WebView DEBUG] Full message:', JSON.stringify(parsed, null, 2))
              if (parsed.args?.[0]?.passkey) {
                const pk = parsed.args[0].passkey
                console.log('[WebView DEBUG] passkey.id:', pk.id)
                console.log('[WebView DEBUG] passkey.key type:', typeof pk.key, 'isArray:', Array.isArray(pk.key), 'length:', pk.key?.length)
                if (Array.isArray(pk.key)) {
                  console.log('[WebView DEBUG] passkey.key first 5 bytes:', pk.key.slice(0, 5))
                }
              }
            }
          } catch (e) {
            // Ignore parse errors for debug logging
          }
          webViewRef.current?.postMessage(transformed)
        },
      }
      client.embeddedWallet.setMessagePoster(messagePoster)
      console.log('[WebView] Message poster set via useEffect')
    }
  }, [client, isClientReady])

  // Clean message handler using the new penpal bridge
  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const messageData = JSON.parse(event?.nativeEvent?.data)
        if (!messageData) return

        // Debug: Log incoming messages from iframe
        if (messageData?.penpal) {
          console.log('[WebView DEBUG] 📥 INCOMING:', messageData.penpal, 'id:', messageData.id)
          
          // Check for error responses
          if (messageData.penpal === 'reply') {
            if (messageData.returnValue !== undefined) {
              console.log('[WebView DEBUG] Reply returnValue type:', typeof messageData.returnValue)
              if (typeof messageData.returnValue === 'object' && messageData.returnValue !== null) {
                // Check for error in response
                if (messageData.returnValue.error || messageData.returnValue.message?.includes('error') || messageData.returnValue.message?.includes('Error')) {
                  console.log('[WebView DEBUG] ❌ ERROR RESPONSE:', JSON.stringify(messageData.returnValue, null, 2))
                } else {
                  console.log('[WebView DEBUG] ✅ Success response keys:', Object.keys(messageData.returnValue))
                }
              }
            }
            if (messageData.returnValueIsError) {
              console.log('[WebView DEBUG] ❌ PENPAL ERROR:', JSON.stringify(messageData, null, 2))
            }
          }
        }

        // Handle secure storage messages
        if (isSecureStorageMessage(messageData)) {
          const response = await handleSecureStorageMessage(messageData)
          webViewRef.current?.postMessage(JSON.stringify(response))
          return
        }
        // Forward all messages to the embedded wallet
        client.embeddedWallet.onMessage(messageData)
      } catch (error) {
        console.log('[WebView DEBUG] ❌ Failed to handle message:', error)
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
        // Ensures passkey keys are proper number[] arrays before sending to Shield iframe
        const messagePoster = {
          postMessage: (message: string) => {
            console.log('[WebView] postMessage called via handleWebViewRef')
            const transformed = ensurePasskeyKeyIsArray(message)
            // Debug: Log full outgoing message for passkey-related calls
            try {
              const parsed = JSON.parse(transformed)
              if (parsed?.methodName === 'create' || parsed?.methodName === 'recover' || parsed?.methodName === 'setRecoveryMethod') {
                console.log('[WebView DEBUG] 📤 OUTGOING REQUEST:', parsed.methodName)
                console.log('[WebView DEBUG] Full message:', JSON.stringify(parsed, null, 2))
                if (parsed.args?.[0]?.passkey) {
                  const pk = parsed.args[0].passkey
                  console.log('[WebView DEBUG] passkey.id:', pk.id)
                  console.log('[WebView DEBUG] passkey.key type:', typeof pk.key, 'isArray:', Array.isArray(pk.key), 'length:', pk.key?.length)
                  if (Array.isArray(pk.key)) {
                    console.log('[WebView DEBUG] passkey.key first 5 bytes:', pk.key.slice(0, 5))
                  }
                }
              }
            } catch (e) {
              // Ignore parse errors for debug logging
            }
            ref.postMessage(transformed)
          },
        }
        client.embeddedWallet.setMessagePoster(messagePoster)
        console.log('[WebView] Message poster set via handleWebViewRef')
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
