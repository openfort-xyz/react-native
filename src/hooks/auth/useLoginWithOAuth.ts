/**
 * Hook for OAuth-based login functionality
 */
import { useCallback, useRef } from 'react';
import { OAuthProvider, type AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';
import {
  openOAuthSession,
  authenticateWithApple,
  isAppleSignInAvailable,
  parseOAuthUrl,
  createOAuthRedirectUri,
  OAuthUtils,
} from '../../native';
import type {
  LoginWithOAuthInput,
  UseLoginWithOAuth,
} from '../../types';

/**
 * Hook for OAuth-based authentication with supported providers
 * 
 * This hook provides OAuth authentication flow for various providers (Google, Apple, Discord, etc.).
 * It opens the provider's web authentication page and handles the OAuth flow automatically.
 * 
 * @param opts - Configuration options including success/error callbacks
 * @returns Object with login function and current OAuth flow state
 * 
 * @example
 * ```tsx
 * const { login, state } = useLoginWithOAuth({
 *   onSuccess: (user) => console.log('OAuth login successful:', user),
 *   onError: (error) => console.error('OAuth login failed:', error),
 * });
 * 
 * // Login with Google
 * const user = await login({ provider: 'google' });
 * 
 * // Login with Apple (using legacy web flow on iOS if needed)
 * const user = await login({ 
 *   provider: 'apple',
 *   isLegacyAppleIosBehaviorEnabled: true 
 * });
 * 
 * // Other supported providers
 * await login({ provider: 'discord' });
 * await login({ provider: 'twitter' });
 * ```
 */
export function useLoginWithOAuth(): UseLoginWithOAuth {
  const { client, oAuthState, setOAuthState, _internal } = useOpenfortContext();

  const login = useCallback(
    async (input: LoginWithOAuthInput): Promise<OpenfortUser | undefined> => {
      try {
        setOAuthState({ status: 'loading' });

        // Initialize OAuth flow
        const redirectUri = input.redirectUri || createOAuthRedirectUri('/oauth/callback');
        const result = await client.auth.initOAuth({
          provider: input.provider,
          options: {
            skipBrowserRedirect: true,
            redirectTo: redirectUri,
          }
        });

        // Handle OAuth flow using native utilities
        setOAuthState({ status: 'awaiting-redirect' });

        // Check if we should use native Apple authentication
        if (input.provider === 'apple' && !input.isLegacyAppleIosBehaviorEnabled) {
          const isAppleAvailable = await isAppleSignInAvailable();
          if (isAppleAvailable) {
            try {
              const appleResult = await authenticateWithApple({
                state: result.key || '',
                isLogin: true,
              });

              // Complete OAuth flow with Apple credentials
              const authResult = await client.auth.loginWithIdToken({
                provider: OAuthProvider.APPLE,
                token: appleResult.identityToken!,
              });

              setOAuthState({ status: 'done' });
              const user = authResult.player;
              // Refresh user state in provider
              await _internal.refreshUserState(user);
              return user;
            } catch (error) {
              // Handle Apple-specific errors
              if (error && typeof error === 'object' && 'code' in error) {
                throw error;
              }
              throw new Error('Apple authentication failed');
            }
          }
        }

        // For other providers, use web-based OAuth
        const providerUrl = OAuthUtils.getProviderUrl(input.provider, result.url);

        const oauthResult = await OAuthUtils.withTimeout(
          openOAuthSession({
            url: providerUrl,
            redirectUri,
          }),
          120000 // 2 minute timeout
        );

        if (oauthResult.type === 'success' && oauthResult.url) {
          // Parse OAuth response from redirect URL
          const { access_token, refresh_token, player_id, error, errorDescription } = parseOAuthUrl(oauthResult.url);

          if (error) {
            throw new Error(errorDescription || error);
          }
          await client.auth.storeCredentials({
            player: player_id,
            accessToken: access_token!,
            refreshToken: refresh_token!,
          });

          setOAuthState({ status: 'done' });
          const user = await client.user.get();
          // Refresh user state in provider
          await _internal.refreshUserState(user);
          return user;
        } else if (oauthResult.type === 'cancel') {
          throw new Error('OAuth authentication was cancelled by user');
        } else {
          throw new Error(oauthResult.error || 'OAuth authentication failed');
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('OAuth login failed');
        setOAuthState({
          status: 'error',
          error: errorObj
        });
        throw errorObj;
      }
    },
    [client, setOAuthState, _internal]
  );

  return {
    login,
    state: oAuthState,
  };
}