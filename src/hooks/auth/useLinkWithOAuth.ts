/**
 * Hook for linking OAuth accounts to existing users
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
  LinkWithOAuthInput,
  UseLinkWithOAuth,
} from '../../types';

/**
 * Hook for linking OAuth accounts to existing authenticated users
 * 
 * This hook allows users who are already authenticated to link additional OAuth providers
 * as alternative authentication methods. The user must be logged in to use this hook.
 * 
 * @param opts - Configuration options including success/error callbacks
 * @returns Object with link function and current OAuth flow state
 * 
 * @example
 * ```tsx
 * const { link, state } = useLinkWithOAuth({
 *   onSuccess: (user) => console.log('OAuth account linked:', user),
 *   onError: (error) => console.error('OAuth linking failed:', error),
 * });
 * 
 * // Link Google account to current user
 * const result = await link({ provider: 'google' });
 * 
 * // Link Apple account (using legacy web flow on iOS if needed)
 * const result = await link({ 
 *   provider: 'apple',
 *   isLegacyAppleIosBehaviorEnabled: true 
 * });
 * 
 * // Other supported providers
 * await link({ provider: 'discord' });
 * await link({ provider: 'twitter' });
 * ```
 */
export function useLinkWithOAuth(): UseLinkWithOAuth {
  const { client, oAuthState, setOAuthState, _internal } = useOpenfortContext();

  const link = useCallback(
    async (input: LinkWithOAuthInput): Promise<OpenfortUser | undefined> => {
      try {
        setOAuthState({ status: 'loading' });

        // Get current user access token for linking
        const accessToken = await client.getAccessToken();
        if (!accessToken) {
          throw new Error('User must be authenticated to link OAuth account');
        }

        // Initialize OAuth linking flow
        const redirectUri = input.redirectUri || createOAuthRedirectUri('/oauth/callback');
        const result = await client.auth.initLinkOAuth({
          provider: input.provider,
          authToken: accessToken,
          options: {
            skipBrowserRedirect: true,
            redirectTo: redirectUri,
          }
        });

        // Handle OAuth linking flow using native utilities
        setOAuthState({ status: 'awaiting-redirect' });

        // Check if we should use native Apple authentication for linking
        if (input.provider === 'apple' && !input.isLegacyAppleIosBehaviorEnabled) {
          const isAppleAvailable = await isAppleSignInAvailable();
          if (isAppleAvailable) {
            try {
              const appleResult = await authenticateWithApple({
                state: result.key || '',
                isLogin: false, // This is a linking operation
              });

              // Complete OAuth linking flow with Apple credentials
              const linkResult = await client.auth.loginWithIdToken(
                {
                  provider: OAuthProvider.APPLE,
                  token: appleResult.identityToken!
                }
              );

              setOAuthState({ status: 'done' });
              const user = linkResult.player;
              // Refresh user state to reflect OAuth linking
              await _internal.refreshUserState();
              return user;
            } catch (error) {
              // Handle Apple-specific errors
              if (error && typeof error === 'object' && 'code' in error) {
                throw error;
              }
              throw new Error('Apple linking failed');
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
          throw new Error('OAuth linking was cancelled by user');
        } else {
          throw new Error(oauthResult.error || 'OAuth linking failed');
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('OAuth linking failed');
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
    link,
    state: oAuthState,
  };
}