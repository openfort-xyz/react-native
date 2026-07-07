---
'@openfort/react-native': patch
---

Improve embedded wallet WebView reliability: automatically reload the hidden WebView when its renderer process is terminated by the OS, retry failed page loads with backoff, health-check the wallet page when the app returns to the foreground, and react to connection-loss events from the core SDK. Secure-storage read failures are now reported explicitly to the wallet page instead of appearing as missing values, and the Openfort client is no longer recreated when a parent re-render passes equivalent inline configuration objects.
