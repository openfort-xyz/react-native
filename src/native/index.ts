// WebView integration
export { EmbeddedWalletWebView, WebViewUtils } from './webview';

// Storage utilities
export {
  isSecureStorageMessage,
  handleSecureStorageMessage,
  NativeStorageUtils,
} from './storage';
export type {
  SecureStorageMessage,
  SecureStorageResponse,
} from './storage';