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


// OAuth flows
export {
  openOAuthSession,
  authenticateWithApple,
  isAppleSignInAvailable,
  parseOAuthUrl,
  createOAuthRedirectUri,
  OAuthUtils,
} from './oauth';
export type {
  OAuthResult,
  AppleAuthResult,
  OAuthSessionConfig,
} from './oauth';