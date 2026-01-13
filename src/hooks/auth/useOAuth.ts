import { OAuthProvider, type User as OpenfortUser } from '@openfort/openfort-js'
import { useCallback } from 'react'
import { useOpenfortContext } from '../../core/context'
import { onError, onSuccess } from '../../lib/hookConsistency'
import {
  authenticateWithApple,
  createOAuthRedirectUri,
  isAppleSignInAvailable,
  OAuthUtils,
  openOAuthSession,
  parseOAuthUrl,
} from '../../native'
import type { OpenfortHookOptions } from '../../types/hookOption'
import { mapOAuthStatus } from '../../types/oauth'
import { OpenfortError, OpenfortErrorType } from '../../types/openfortError'

export type InitializeOAuthOptions = {
  provider: OAuthProvider
  redirectTo?: string
} & OpenfortHookOptions<InitOAuthReturnType>

export type StoreCredentialsResult = {
  // type: "storeCredentials";
  user?: OpenfortUser
  // wallet?: UserWallet;
  error?: OpenfortError
}

export type InitOAuthReturnType = {
  error?: OpenfortError
  user?: OpenfortUser
}

export type AuthHookOptions = {
  redirectTo?: string
} & OpenfortHookOptions<StoreCredentialsResult | InitOAuthReturnType>

/**
 * Hook for OAuth-based authentication with supported providers.
 *
 * This hook provides OAuth authentication flows including login and account linking
 * for various OAuth providers (Google, Apple, Discord, Twitter, Facebook, etc.).
 * Supports both web-based OAuth flows and native Apple Sign-In on iOS.
 *
 * @param hookOptions - Configuration options including success and error callbacks
 * @returns OAuth authentication methods and flow state including:
 *   - `initOAuth` - Start OAuth login flow for authentication
 *   - `linkOauth` - Link additional OAuth provider to authenticated account
 *   - `storeCredentials` - (Reserved for future use)
 *   - `isLoading` - Whether OAuth flow is in progress
 *   - `isError` - Whether the last OAuth flow failed
 *   - `isSuccess` - Whether the last OAuth flow succeeded
 *   - `error` - Error from the last failed OAuth operation
 *
 * @example
 * ```tsx
 * import { OAuthProvider } from '@openfort/openfort-js';
 *
 * const { initOAuth, linkOauth, isLoading, isError, error } = useOAuth({
 *   onSuccess: ({ user }) => console.log('OAuth completed for', user?.id),
 * });
 *
 * // Start a login flow
 * await initOAuth({ provider: OAuthProvider.GOOGLE });
 *
 * // Later, link another provider for the signed-in user
 * await linkOauth({ provider: OAuthProvider.DISCORD });
 *
 * if (isError) {
 *   console.warn('Latest OAuth attempt failed', error);
 * }
 * ```
 */
export const useOAuth = (hookOptions: AuthHookOptions = {}) => {
  const { client, oAuthState, setOAuthState, _internal } = useOpenfortContext()

  const initOAuth = useCallback(
    async (options: InitializeOAuthOptions): Promise<InitOAuthReturnType> => {
      try {
        setOAuthState({ status: 'loading' })

        // Initialize OAuth flow
        const redirectUri = options.redirectTo || createOAuthRedirectUri('/oauth/callback')
        const result = await client.auth.initOAuth({
          provider: options.provider,
          redirectTo: redirectUri,
          options: {
            skipBrowserRedirect: true,
          },
        })

        // Handle OAuth flow using native utilities
        setOAuthState({ status: 'awaiting-redirect' })

        // Check if we should use native Apple authentication
        if (options.provider === 'apple') {
          const isAppleAvailable = await isAppleSignInAvailable()
          if (isAppleAvailable) {
            try {
              const appleResult = await authenticateWithApple({
                state: result || '',
                isLogin: true,
              })

              // Complete OAuth flow with Apple credentials
              const authResult = await client.auth.logInWithIdToken({
                provider: OAuthProvider.APPLE,
                token: appleResult.identityToken!,
              })

              setOAuthState({ status: 'done' })
              const user = authResult.user
              // Refresh user state in provider
              await _internal.refreshUserState(user)

              return onSuccess({
                options,
                hookOptions,
                data: { user },
              })
            } catch (e) {
              const error = new OpenfortError('Apple authentication failed', OpenfortErrorType.AUTHENTICATION_ERROR, {
                error: e,
              })
              setOAuthState({
                status: 'error',
                error,
              })
              return onError({
                options,
                hookOptions,
                error,
              })
            }
          }
        }

        // For other providers, use web-based OAuth
        const providerUrl = OAuthUtils.getProviderUrl(options.provider, result)

        const oauthResult = await OAuthUtils.withTimeout(
          openOAuthSession({
            url: providerUrl,
            redirectUri,
          }),
          120000 // 2 minute timeout
        )

        if (oauthResult.type === 'success' && oauthResult.url) {
          // Parse OAuth response from redirect URL
          const { access_token, user_id, error, errorDescription } = parseOAuthUrl(oauthResult.url)

          if (error || !user_id) {
            throw new Error(errorDescription || error)
          }
          await client.auth.storeCredentials({
            userId: user_id,
            token: access_token!,
          })

          setOAuthState({ status: 'done' })
          const user = await client.user.get()
          // Refresh user state in provider
          await _internal.refreshUserState(user)
          return onSuccess({
            options,
            hookOptions,
            data: { user },
          })
        } else if (oauthResult.type === 'cancel') {
          const error = new OpenfortError(
            'OAuth authentication was cancelled by user',
            OpenfortErrorType.AUTHENTICATION_ERROR
          )
          setOAuthState({
            status: 'error',
            error,
          })
          return onError({
            options,
            hookOptions,
            error,
          })
        } else {
          const error = new OpenfortError(
            oauthResult.error || 'OAuth authentication failed',
            OpenfortErrorType.AUTHENTICATION_ERROR
          )
          setOAuthState({
            status: 'error',
            error,
          })
          return onError({
            options,
            hookOptions,
            error,
          })
        }
      } catch (e) {
        const error = new OpenfortError('OAuth initialization failed', OpenfortErrorType.AUTHENTICATION_ERROR, {
          error: e,
        })
        setOAuthState({
          status: 'error',
          error,
        })
        return onError({
          options,
          hookOptions,
          error,
        })
      }
    },
    [client, setOAuthState, _internal]
  )

  const linkOauth = useCallback(
    async (options: InitializeOAuthOptions): Promise<InitOAuthReturnType> => {
      try {
        setOAuthState({ status: 'loading' })

        // Get current user access token for linking
        const accessToken = await client.getAccessToken()
        if (!accessToken) {
          throw new Error('User must be authenticated to link OAuth account')
        }

        // Initialize OAuth linking flow
        const redirectUri = options.redirectTo || createOAuthRedirectUri('/oauth/callback')
        const result = await client.auth.initLinkOAuth({
          provider: options.provider,
          // authToken: accessToken,
          redirectTo: redirectUri,
          options: {
            skipBrowserRedirect: true,
          },
        })

        // Handle OAuth linking flow using native utilities
        setOAuthState({ status: 'awaiting-redirect' })

        // Check if we should use native Apple authentication for linking
        if (options.provider === 'apple') {
          const isAppleAvailable = await isAppleSignInAvailable()
          if (isAppleAvailable) {
            try {
              const appleResult = await authenticateWithApple({
                state: result || '',
                isLogin: false, // This is a linking operation
              })

              // Complete OAuth linking flow with Apple credentials
              const linkResult = await client.auth.logInWithIdToken({
                provider: OAuthProvider.APPLE,
                token: appleResult.identityToken!,
              })

              setOAuthState({ status: 'done' })
              const user = linkResult.user
              // Refresh user state to reflect OAuth linking
              await _internal.refreshUserState()
              return onSuccess({
                options,
                hookOptions,
                data: { user },
              })
            } catch (e) {
              const error = new OpenfortError('Apple linking failed', OpenfortErrorType.AUTHENTICATION_ERROR, {
                error: e,
              })
              setOAuthState({
                status: 'error',
                error,
              })
              return onError({
                options,
                hookOptions,
                error,
              })
            }
          }
        }

        // For other providers, use web-based OAuth
        const providerUrl = OAuthUtils.getProviderUrl(options.provider, result)

        const oauthResult = await OAuthUtils.withTimeout(
          openOAuthSession({
            url: providerUrl,
            redirectUri,
          }),
          120000 // 2 minute timeout
        )

        if (oauthResult.type === 'success' && oauthResult.url) {
          // Parse OAuth response from redirect URL
          const { access_token, user_id, error, errorDescription } = parseOAuthUrl(oauthResult.url)

          if (error || !user_id) {
            throw new Error(errorDescription || error)
          }
          await client.auth.storeCredentials({
            userId: user_id,
            token: access_token!,
          })

          setOAuthState({ status: 'done' })
          const user = await client.user.get()
          // Refresh user state in provider
          await _internal.refreshUserState(user)
          return onSuccess({
            options,
            hookOptions,
            data: { user },
          })
        } else if (oauthResult.type === 'cancel') {
          const error = new OpenfortError('OAuth linking was cancelled by user', OpenfortErrorType.AUTHENTICATION_ERROR)
          setOAuthState({
            status: 'error',
            error,
          })
          return onError({
            options,
            hookOptions,
            error,
          })
        } else {
          const error = new OpenfortError(
            oauthResult.error || 'OAuth linking failed',
            OpenfortErrorType.AUTHENTICATION_ERROR
          )
          setOAuthState({
            status: 'error',
            error,
          })
          return onError({
            options,
            hookOptions,
            error,
          })
        }
      } catch (e) {
        const error = new OpenfortError('OAuth linking failed', OpenfortErrorType.AUTHENTICATION_ERROR, { error: e })
        setOAuthState({
          status: 'error',
          error,
        })
        return onError({
          options,
          hookOptions,
          error,
        })
      }
    },
    [client, setOAuthState, _internal]
  )

  return {
    initOAuth,
    linkOauth,
    ...mapOAuthStatus(oAuthState),
  }
}
