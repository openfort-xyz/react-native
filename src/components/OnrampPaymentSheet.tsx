// biome-ignore lint/correctness/noUnusedImports: classic JSX ("jsx": "react") resolves React at compile time
import React, { useCallback, useMemo } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import WebView, { type WebViewMessageEvent } from 'react-native-webview'

/**
 * A raw event posted by the provider's payment page (Coinbase headless onramp:
 * `onramp_api.load_pending`, `onramp_api.load_success`,
 * `onramp_api.commit_success`, `onramp_api.polling_success`, and error events
 * carrying `errorCode`/`errorMessage`).
 */
export type OnrampSheetEvent = {
  eventName: string
  data?: { errorCode?: string; errorMessage?: string } & Record<string, unknown>
}

export type OnrampPaymentSheetProps = {
  /**
   * The payment-link URL from the committed funding session's payment method
   * (`session.paymentMethod.url`). For sandbox (test-mode) sessions the api
   * already appends the `useApplePaySandbox`/`useGooglePaySandbox` flag, which
   * replaces the real payment sheet with Coinbase's test popup.
   */
  url: string
  /** Fired on `onramp_api.commit_success` — the payment is committed; the funding session settles via webhooks. */
  onCommitted?: () => void
  /** Fired on an error event, with the provider's code + message. */
  onError?: (errorCode: string, errorMessage: string) => void
  /** Every raw provider event, for custom handling or telemetry. */
  onEvent?: (event: OnrampSheetEvent) => void
  style?: StyleProp<ViewStyle>
}

// The payment page reports through `androidWebView.postMessage` when present
// (Coinbase's documented Android contract) and `window.postMessage` otherwise;
// both are forwarded onto React Native's bridge before the page loads.
const BRIDGE_SCRIPT = `(function () {
  var forward = function (payload) {
    try {
      window.ReactNativeWebView.postMessage(typeof payload === 'string' ? payload : JSON.stringify(payload));
    } catch (e) {}
  };
  window.androidWebView = { postMessage: forward };
  window.addEventListener('message', function (e) { forward(e.data); });
})(); true;`

/**
 * In-app mount for a Coinbase native wallet-pay (Apple/Google Pay) payment
 * link. Renders the provider's Pay button in a WebView with the bridge and
 * settings Coinbase's headless onramp requires (JavaScript, the Android
 * Payment Request API, and the postMessage relay), and surfaces the page's
 * lifecycle events as callbacks.
 *
 * The sheet's job ends at `onCommitted` — the funding session (webhooks /
 * polling) stays the source of truth for settlement, never the page.
 *
 * @example
 * ```tsx
 * // identity from useWalletPayVerification; commit the onramp payment method,
 * // then mount the returned payment link:
 * <OnrampPaymentSheet
 *   url={session.paymentMethod.url}
 *   onCommitted={() => track(session)}
 *   onError={(code, message) => setFailure(message)}
 *   style={{ height: 380 }}
 * />
 * ```
 */
export function OnrampPaymentSheet({ url, onCommitted, onError, onEvent, style }: OnrampPaymentSheetProps) {
  const source = useMemo(() => ({ uri: url }), [url])

  const handleMessage = useCallback(
    (message: WebViewMessageEvent) => {
      let event: OnrampSheetEvent
      try {
        event = JSON.parse(message.nativeEvent.data)
      } catch {
        return
      }
      if (!event || typeof event.eventName !== 'string') return
      onEvent?.(event)
      if (event.eventName === 'onramp_api.commit_success') {
        onCommitted?.()
      } else if (event.data?.errorCode || event.data?.errorMessage) {
        onError?.(event.data.errorCode ?? 'unknown', event.data.errorMessage ?? 'Payment failed.')
      }
    },
    [onCommitted, onError, onEvent]
  )

  return (
    <WebView
      source={source}
      style={style}
      javaScriptEnabled
      // Android's Payment Request API — required for the Google Pay sheet.
      paymentRequestEnabled
      injectedJavaScriptBeforeContentLoaded={BRIDGE_SCRIPT}
      onMessage={handleMessage}
      // http covers the sandbox's localhost/emulator embedding allowance.
      originWhitelist={['https://*', 'http://*']}
      setSupportMultipleWindows={false}
    />
  )
}
