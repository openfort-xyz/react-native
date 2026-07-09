---
'@openfort/react-native': patch
---

Fix embedded wallet disconnecting after the app returns from the background. The foreground health-check no longer reloads the wallet WebView: a reload discards the embed page's in-memory signer/session state with no re-configure afterwards, which dropped the wallet back to a disconnected state (the UI fell back to the connect screen and subsequent RPCs failed with "Unauthorized - call eth_requestAccounts first"). Genuinely dead renderers are still recovered via the renderer-crash handlers, and real RPC/handshake timeouts via the connection-lost event.
