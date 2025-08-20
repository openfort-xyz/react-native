/**
 * Hook for OAuth-based login functionality
 */
import { OAuthProvider, type AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js';
import { useCallback } from 'react';
import { useOpenfortContext } from '../../core/context';
import {
  authenticateWithApple,
  createOAuthRedirectUri,
  isAppleSignInAvailable,
  OAuthUtils,
  openOAuthSession,
  parseOAuthUrl,
} from '../../native';
import { mapOAuthStatus } from "../../types/oauth";
import { OpenfortHookOptions } from '../../types/hookOption';
import { CreateWalletPostAuthOptions } from './useCreateWalletPostAuth';
import { OpenfortError, OpenfortErrorType } from '../../types/openfortError';
import { onError, onSuccess } from '../../lib/hookConsistency';

export type InitializeOAuthOptions = {
  provider: OAuthProvider,
  redirectTo?: string;
  isLegacyAppleIosBehaviorEnabled?: boolean;
} & OpenfortHookOptions<InitOAuthReturnType>;

export type StoreCredentialsResult = {
  // type: "storeCredentials";
  user?: OpenfortUser;
  // wallet?: UserWallet;
  error?: OpenfortError;
}

export type InitOAuthReturnType = {
  error?: OpenfortError;
  user?: OpenfortUser;
}

export type AuthHookOptions = {
  redirectTo?: string;
} & OpenfortHookOptions<StoreCredentialsResult | InitOAuthReturnType> & CreateWalletPostAuthOptions;

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
export const useOAuth = (hookOptions: AuthHookOptions = {}) => {
  const { client, oAuthState, setOAuthState, _internal } = useOpenfortContext();

  const initOAuth = useCallback(
    async (options: InitializeOAuthOptions): Promise<InitOAuthReturnType> => {
      try {
        setOAuthState({ status: 'loading' });

        // Initialize OAuth flow
        const redirectUri = options.redirectTo || createOAuthRedirectUri('/oauth/callback');
        const result = await client.auth.initOAuth({
          provider: options.provider,
          options: {
            skipBrowserRedirect: true,
            redirectTo: redirectUri,
          }
        });

        // Handle OAuth flow using native utilities
        setOAuthState({ status: 'awaiting-redirect' });

        // Check if we should use native Apple authentication
        if (options.provider === 'apple' && !options.isLegacyAppleIosBehaviorEnabled) {
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

              return onSuccess({
                options,
                hookOptions,
                data: { user },
              })
            } catch (e) {
              const error = new OpenfortError('Apple authentication failed', OpenfortErrorType.AUTHENTICATION_ERROR, { error: e });
              setOAuthState({
                status: 'error',
                error,
              });
              return onError({
                options,
                hookOptions,
                error,
              });
            }
          }
        }

        // For other providers, use web-based OAuth
        const providerUrl = OAuthUtils.getProviderUrl(options.provider, result.url);

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
          return onSuccess({
            options,
            hookOptions,
            data: { user },
          });
        } else if (oauthResult.type === 'cancel') {
          const error = new OpenfortError('OAuth authentication was cancelled by user', OpenfortErrorType.AUTHENTICATION_ERROR);
          setOAuthState({
            status: 'error',
            error,
          });
          return onError({
            options,
            hookOptions,
            error,
          });
        } else {
          const error = new OpenfortError(oauthResult.error || 'OAuth authentication failed', OpenfortErrorType.AUTHENTICATION_ERROR);
          setOAuthState({
            status: 'error',
            error,
          });
          return onError({
            options,
            hookOptions,
            error,
          });
        }
      } catch (e) {
        const error = new OpenfortError('OAuth initialization failed', OpenfortErrorType.AUTHENTICATION_ERROR, { error: e });
        setOAuthState({
          status: 'error',
          error
        });
        return onError({
          options,
          hookOptions,
          error,
        });
      }
    },
    [client, setOAuthState, _internal]
  );

  const linkOauth = useCallback(
    async (options: InitializeOAuthOptions): Promise<InitOAuthReturnType> => {
      try {
        setOAuthState({ status: 'loading' });

        // Get current user access token for linking
        const accessToken = await client.getAccessToken();
        if (!accessToken) {
          throw new Error('User must be authenticated to link OAuth account');
        }

        // Initialize OAuth linking flow
        const redirectUri = options.redirectTo || createOAuthRedirectUri('/oauth/callback');
        const result = await client.auth.initLinkOAuth({
          provider: options.provider,
          authToken: accessToken,
          options: {
            skipBrowserRedirect: true,
            redirectTo: redirectUri,
          }
        });

        // Handle OAuth linking flow using native utilities
        setOAuthState({ status: 'awaiting-redirect' });

        // Check if we should use native Apple authentication for linking
        if (options.provider === 'apple' && !options.isLegacyAppleIosBehaviorEnabled) {
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
              return onSuccess({
                options,
                hookOptions,
                data: { user },
              });
            } catch (e) {
              const error = new OpenfortError('Apple linking failed', OpenfortErrorType.AUTHENTICATION_ERROR, { error: e });
              setOAuthState({
                status: 'error',
                error,
              });
              return onError({
                options,
                hookOptions,
                error,
              });
            }
          }
        }

        // For other providers, use web-based OAuth
        const providerUrl = OAuthUtils.getProviderUrl(options.provider, result.url);

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
          return onSuccess({
            options,
            hookOptions,
            data: { user },
          });
        } else if (oauthResult.type === 'cancel') {
          const error = new OpenfortError('OAuth linking was cancelled by user', OpenfortErrorType.AUTHENTICATION_ERROR);
          setOAuthState({
            status: 'error',
            error,
          });
          return onError({
            options,
            hookOptions,
            error,
          });
        } else {
          const error = new OpenfortError(oauthResult.error || 'OAuth linking failed', OpenfortErrorType.AUTHENTICATION_ERROR);
          setOAuthState({
            status: 'error',
            error,
          });
          return onError({
            options,
            hookOptions,
            error,
          });
        }
      } catch (e) {
        const error = new OpenfortError('OAuth linking failed', OpenfortErrorType.AUTHENTICATION_ERROR, { error: e });
        setOAuthState({
          status: 'error',
          error
        });
        return onError({
          options,
          hookOptions,
          error
        });
      }
    },
    [client, setOAuthState, _internal]
  );

  const storeCredentials = () => { } // TODO

  return {
    initOAuth,
    linkOauth,
    storeCredentials,
    ...mapOAuthStatus(oAuthState),
  };
}