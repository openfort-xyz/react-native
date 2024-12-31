import React from 'react';
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import WebView, { WebViewMessageEvent } from "react-native-webview";

const injectedCode = `
  window.parent = {};
  window.parent.postMessage = (msg) =>  window.ReactNativeWebView.postMessage(JSON.stringify(msg))
  `;

export default function Iframe({ customUri }: { customUri?: string }) {

  const webViewRef = useRef<WebView>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fnCallbackRef = useRef<any>(null); // Ref to store the callback

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    global.openfortListener = (fn: ((event: MessageEvent<unknown>) => void)) => {
      fnCallbackRef.current = fn; // Store the callback in the ref
    };

    global.openfortPostMessage = (message: MessageEvent<unknown>) => {
      webViewRef?.current?.postMessage(JSON.stringify(message))
      setLoaded(true);
    };
  }, [webViewRef?.current]);

  const handleMessage = (event: WebViewMessageEvent) => {
    // Trigger the stored callback, if any
    if (fnCallbackRef.current) {
      const origin = event.nativeEvent.url.endsWith('/') ? event.nativeEvent.url.slice(0, -1) : event.nativeEvent.url;
      fnCallbackRef.current({ origin, data: event.nativeEvent.data });
    }
  };

  if (!loaded) return null;

  const uri = customUri ? customUri : "https://embedded.openfort.xyz";

  return (
    <View style={{ flex: 0 }}>
      <WebView
        ref={webViewRef}
        source={{ uri: uri }}
        onMessage={handleMessage}
        injectedJavaScript={injectedCode}
      />
    </View>
  )
}