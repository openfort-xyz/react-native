import React, { useRef, useCallback, useEffect } from 'react';
import { AppState, Platform, View } from 'react-native';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import type { Openfort as OpenfortClient} from '@openfort/openfort-js';
import { isSecureStorageMessage, handleSecureStorageMessage } from './storage';

/**
 * Configuration for WebView used by embedded wallets
 */
interface WebViewConfig {
  /** Whether to use app-backed storage for the WebView */
  shouldUseAppBackedStorage: boolean;
}

/**
 * Props for the EmbeddedWalletWebView component
 */
interface EmbeddedWalletWebViewProps {
  /** Openfort client instance */
  client: OpenfortClient;
  /** Whether the client is ready and initialized */
  isClientReady: boolean;
  /** Callback when WebView proxy status changes */
  onProxyStatusChange?: (status: 'loading' | 'loaded' | 'reloading') => void;
}

/**
 * Default WebView configuration
 */
const DEFAULT_WEBVIEW_CONFIG: WebViewConfig = {
  shouldUseAppBackedStorage: true,
};

/**
 * WebView component for embedded wallet integration
 * Handles secure communication between React Native and the embedded wallet WebView
 * This component is hidden and only used for wallet communication
 */
export const EmbeddedWalletWebView: React.FC<EmbeddedWalletWebViewProps> = ({
  client,
  isClientReady,
  onProxyStatusChange,
}) => {
  const webViewRef = useRef<WebView>(null);

  // Handle app state changes to monitor WebView health
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Check if embedded wallet is still responsive
        try {
          const isResponsive = await client.embeddedWallet.ping(500);
          // if (!isResponsive) {
          //   onProxyStatusChange?.('reloading');
          //   // client.embeddedWallet.reload();
          // }
        } catch (error) {
          console.warn('Failed to ping embedded wallet:', error);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [client, onProxyStatusChange]);

  // Handle messages from WebView
  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const messageData = JSON.parse(event.nativeEvent.data);

      // Handle secure storage messages
      if (isSecureStorageMessage(messageData)) {
        const response = await handleSecureStorageMessage(messageData);
        webViewRef.current?.postMessage(JSON.stringify(response));
        return;
      }

      // Forward other messages to the embedded wallet
      client.embeddedWallet.onMessage(messageData);
    } catch (error) {
      console.error('Failed to handle WebView message:', error);
    }
  }, [client]);

  // Handle WebView load events
  const handleLoad = useCallback(() => {
    onProxyStatusChange?.('loaded');
  }, [onProxyStatusChange]);

  const handleError = useCallback((error: any) => {
    console.error('WebView error:', error);
  }, []);

  // Set up WebView reference with client
  useEffect(() => {
    if (webViewRef.current && isClientReady) {
      client.setMessagePoster(webViewRef.current);
    }
  }, [client, isClientReady]);

  if (!isClientReady) {
    return null;
  }

  return (
    <div style= {{ width: 0, height: 0, overflow: 'hidden' }}>
      <WebView
        ref={ webViewRef }
        style = {{ flex: 1 }}
        source = {{ uri: client.embeddedWallet.getURL() }}
        cacheEnabled = { false}
        cacheMode = "LOAD_NO_CACHE"
        injectedJavaScriptObject = { DEFAULT_WEBVIEW_CONFIG }
        webviewDebuggingEnabled = { true }
        onLoad = { handleLoad }
        onError = { handleError }
        onMessage = { handleMessage }
        // Security settings
        allowsInlineMediaPlayback = { false}
        mediaPlaybackRequiresUserAction = { true}
        allowsLinkPreview = { false}
        // Performance settings
        startInLoadingState = { true}
      />
    </div>
  );
};

/**
 * Utilities for WebView integration
 */
export const WebViewUtils = {
  /**
   * Checks if WebView is supported on the current platform
   */
  isSupported(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
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
      };
    }

    if (Platform.OS === 'android') {
      return {
        domStorageEnabled: false,
        javaScriptCanOpenWindowsAutomatically: false,
        mixedContentMode: 'never',
      };
    }

    return {};
  },

  /**
   * Creates a secure message for WebView communication
   */
  createSecureMessage(data: any): string {
    return JSON.stringify({
      timestamp: Date.now(),
      platform: Platform.OS,
      data,
    });
  },

  /**
   * Validates a message received from WebView
   */
  validateMessage(message: string): { isValid: boolean; data?: any; error?: string } {
    try {
      const parsed = JSON.parse(message);

      // Basic validation
      if (typeof parsed !== 'object' || parsed === null) {
        return { isValid: false, error: 'Invalid message format' };
      }

      return { isValid: true, data: parsed };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Failed to parse message'
      };
    }
  },

  /**
   * Gets WebView user agent for the current platform
   */
  getUserAgent(): string {
    const baseAgent = 'OpenfortEmbeddedWallet/1.0';
    return `${baseAgent} (${Platform.OS}; ${Platform.Version})`;
  },
};