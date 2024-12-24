import React from 'react';
import Openfort from "@openfort/openfort-js";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import WebView, { WebViewMessageEvent } from "react-native-webview";

const injectedCode = `
  window.parent = {};
  window.parent.postMessage = (msg) =>  window.ReactNativeWebView.postMessage(JSON.stringify(msg))
  `;

export default function Iframe({ customUri }: { customUri?: string }) {

  const webViewRef = useRef<WebView>(null);
  const fnCallbackRef = useRef<any>(null); // Ref to store the callback

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    global.openfortListener = (fn: ((event: MessageEvent<any>) => void)) => {
      fnCallbackRef.current = fn; // Store the callback in the ref
    };

    global.openfortPostMessage = (message: MessageEvent<any>) => {
      webViewRef?.current?.postMessage(JSON.stringify(message))
      setLoaded(true);
    };
  }, [webViewRef?.current]);

  const handleMessage = (event: WebViewMessageEvent) => {
    // Trigger the stored callback, if any
    if (fnCallbackRef.current) {
      fnCallbackRef.current({ origin: event.nativeEvent.url, data: event.nativeEvent.data });
    }
  };

  if (!loaded) return null;

  const uri = customUri ? customUri : "https://iframe.openfort.xyz/";
  console.log("IFRAME customUri", uri);

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