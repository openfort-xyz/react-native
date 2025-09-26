import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { logger } from '../lib/logger';
import * as AppleAuthentication from 'expo-apple-authentication';
import { OAuthProvider as OAuthProviderType } from '@openfort/openfort-js';

/**
 * OAuth authentication result
 */
export interface OAuthResult {
  type: 'success' | 'cancel' | 'error';
  url?: string;
  error?: string;
}

/**
 * Apple Sign-In authentication result
 */
export interface AppleAuthResult {
  authorizationCode: string;
  state: string;
  identityToken?: string;
  email?: string;
  fullName?: AppleAuthentication.AppleAuthenticationFullName;
}

/**
 * OAuth session configuration
 */
export interface OAuthSessionConfig {
  /** OAuth provider URL */
  url: string;
  /** Redirect URI for OAuth flow */
  redirectUri: string;
}

/**
 * Opens an OAuth authentication session
 */
export async function openOAuthSession(config: OAuthSessionConfig): Promise<OAuthResult> {
  try {
    const result = await WebBrowser.openAuthSessionAsync(
      config.url,
      config.redirectUri,
      {
        // Additional options can be configured here
        showInRecents: false,
      }
    );

    if (result.type === 'success') {
      return {
        type: 'success',
        url: result.url,
      };
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return {
        type: 'cancel',
      };
    }

    return {
      type: 'error',
      error: 'OAuth session failed',
    };
  } catch (error) {
    return {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown OAuth error',
    };
  }
}

/**
 * Handles Apple Sign-In authentication for iOS
 */
export async function authenticateWithApple(options: {
  state: string;
  isLogin: boolean;
}): Promise<AppleAuthResult> {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In is only available on iOS');
  }

  try {
    const result = await AppleAuthentication.signInAsync({
      state: options.state,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
    });

    if (!result.authorizationCode || !result.state) {
      throw new Error('Invalid Apple authentication response');
    }

    return {
      authorizationCode: result.authorizationCode,
      state: result.state,
      identityToken: result.identityToken || undefined,
      email: result.email || undefined,
      fullName: result.fullName || undefined,
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') {
      const errorCode = options.isLogin
        ? 'login_with_oauth_was_cancelled_by_user'
        : 'link_with_oauth_was_cancelled_by_user';

      throw {
        code: errorCode,
        error: 'Apple login was cancelled',
      };
    }

    throw error;
  }
}

/**
 * Checks if Apple Sign-In is available on the current device
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Parses OAuth parameters from a redirect URL
 *
 * This function extracts OAuth authentication parameters from a callback URL after
 * a successful or failed OAuth flow. It safely handles URL parsing errors.
 *
 * @param url - The OAuth redirect URL containing query parameters
 * @returns Object containing parsed OAuth parameters including tokens and error information
 *
 * @example
 * ```tsx
 * const redirectUrl = 'myapp://oauth/callback?access_token=abc123&player_id=player_123';
 * const result = parseOAuthUrl(redirectUrl);
 *
 * if (result.access_token && result.player_id) {
 *   console.log('OAuth successful:', result.player_id);
 * } else if (result.error) {
 *   console.error('OAuth failed:', result.errorDescription);
 * }
 * ```
 */
export function parseOAuthUrl(url: string): {
  access_token?: string;
  refresh_token?: string;
  player_id?: string;
  error?: string;
  errorDescription?: string;
} {
  try {
    const { queryParams } = Linking.parse(url);
    logger.info('Parsed OAuth URL', queryParams);

    return {
      access_token: queryParams?.access_token as string,
      refresh_token: queryParams?.refresh_token as string,
      player_id: queryParams?.player_id as string,
      error: queryParams?.error as string,
      errorDescription: queryParams?.error_description as string,
    };
  } catch (error) {
    logger.warn('Failed to parse OAuth URL', error);
    return {};
  }
}

/**
 * Creates a redirect URI for OAuth flows
 *
 * This function generates a deep link URL that OAuth providers can redirect back to
 * after authentication. The URL follows the app's custom URL scheme.
 *
 * @param path - The path component for the redirect URI, defaults to '/'
 * @returns A complete redirect URI that can be used in OAuth flows
 *
 * @example
 * ```tsx
 * // Create default OAuth callback URI
 * const callbackUri = createOAuthRedirectUri('/oauth/callback');
 * console.log(callbackUri); // 'myapp://oauth/callback'
 *
 * // Use in OAuth configuration
 * const oauthConfig = {
 *   redirectUri: createOAuthRedirectUri('/auth/success'),
 *   provider: 'google',
 * };
 * ```
 */
export function createOAuthRedirectUri(path: string = '/'): string {
  return Linking.createURL(path);
}

/**
 * OAuth provider utilities
 */
export const OAuthUtils = {
  /**
   * Checks if a provider should use native authentication
   */
  shouldUseNativeAuth(
    provider: OAuthProviderType,
    isLegacyAppleIosBehaviorEnabled: boolean = false
  ): boolean {
    return (
      Platform.OS === 'ios' &&
      provider === 'apple' &&
      !isLegacyAppleIosBehaviorEnabled
    );
  },

  /**
   * Gets platform-specific OAuth configuration
   */
  getPlatformConfig(): {
    supportsNativeApple: boolean;
    platform: string;
    supportsWebBrowser: boolean;
  } {
    return {
      supportsNativeApple: Platform.OS === 'ios',
      platform: Platform.OS,
      supportsWebBrowser: true,
    };
  },

  /**
   * Validates OAuth provider support
   */
  isProviderSupported(provider: OAuthProviderType): boolean {
    const supportedProviders: OAuthProviderType[] = [
      OAuthProviderType.GOOGLE,
      OAuthProviderType.TWITTER,
      OAuthProviderType.DISCORD,
      OAuthProviderType.LINE,
      OAuthProviderType.FACEBOOK,
      OAuthProviderType.EPIC_GAMES,
      OAuthProviderType.APPLE
    ];

    return supportedProviders.includes(provider);
  },

  /**
   * Gets the appropriate OAuth URL for a provider
   */
  getProviderUrl(provider: OAuthProviderType, baseUrl: string): string {
    // Handle Twitter URL compatibility between platforms
    if (provider === 'twitter' && Platform.OS === 'android') {
      return baseUrl.replace('x.com', 'twitter.com');
    }

    return baseUrl;
  },

  /**
   * Handles OAuth session timeout
   */
  createTimeoutPromise(timeoutMs: number = 120000): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('OAuth session timed out'));
      }, timeoutMs);
    });
  },

  /**
   * Combines OAuth session with timeout
   */
  async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number = 120000
  ): Promise<T> {
    return Promise.race([
      promise,
      this.createTimeoutPromise(timeoutMs),
    ]);
  },
};