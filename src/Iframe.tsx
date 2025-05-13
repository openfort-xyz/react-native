import React from 'react';
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import WebView, { WebViewMessageEvent } from "react-native-webview";

const debugInjectedCode = `
  console.log = function(...message) {
    const safeMessage = JSON.stringify({ ...message, type: "log" });
    window.ReactNativeWebView.postMessage(safeMessage);
  };

  console.warn = console.log;
  console.error = console.log;
  console.info = console.log;
  console.debug = console.log;

  console.log("injecting Code");
`;

const injectedCode = `
  window.parent = {};
  window.parent.postMessage = (msg) =>  {console.log("---", msg); window.ReactNativeWebView.postMessage(JSON.stringify(msg))}

  window.isAndroid = ${Platform.OS === 'android' ? 'true' : 'false'};
`;

export default function Iframe({ customUri, debug, debugVisible }: { customUri?: string, debug?: boolean, debugVisible?: boolean }) {
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

      if (debug)
        console.log("[Send message to web view]", message);

      setLoaded(true);
    };
  }, [webViewRef?.current]);

  const handleMessage = (event: WebViewMessageEvent) => {
    // Trigger the stored callback, if any
    if (fnCallbackRef.current) {
      const origin = event.nativeEvent.url.endsWith('/') ? event.nativeEvent.url.slice(0, -1) : event.nativeEvent.url;
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data?.type === "log") {

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { type, ...dataWithoutType } = data;

          if (debug)
            console.log("[Webview LOG]", Object.values(dataWithoutType).join(", "));
        } else {
          if (debug)
            console.log("[Webview message received]", data);
        }
      } catch {
        if (debug)
          console.log("[Webview message received]", event.nativeEvent.data);
      }
      fnCallbackRef.current({ origin, data: event.nativeEvent.data });
    }
  };

  if (!loaded) return null;

  const uri = customUri ? customUri : "https://embedded.openfort.xyz";

  const finalUri = new URL(uri);
  if (debug) {
    finalUri.searchParams.set('debug', 'true');
  }
  const uriWithParams = finalUri.toString();

  return (
    <View style={{ flex: debugVisible ? 1 : 0 }}>
      <WebView
        ref={webViewRef}
        source={{ uri: uriWithParams }}
        onMessage={handleMessage}
        injectedJavaScript={injectedCode + (debug ? debugInjectedCode : "")}
      />
    </View>
  )
}