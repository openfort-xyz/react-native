/**
 * Hook for OAuth-based login functionality
 */
import { useCallback, useRef } from 'react';
import type { AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';
import type {
  OAuthFlowState,
  OAuthHookOptions,
  LoginWithOAuthInput,
  UseLoginWithOAuth,
} from '../../types';

/**
 * Hook for logging in users with OAuth providers
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
 * await login({ provider: 'google' });
 * 
 * // Login with Apple (using legacy web flow on iOS)
 * await login({ 
 *   provider: 'apple',
 *   isLegacyAppleIosBehaviorEnabled: true 
 * });
 * ```
 */
export function useLoginWithOAuth(opts?: OAuthHookOptions): UseLoginWithOAuth {
  const { client, oAuthState, setOAuthState } = useOpenfortContext();
  const callbacksRef = useRef(opts);
  callbacksRef.current = opts;

  const login = useCallback(
    async (input: LoginWithOAuthInput): Promise<OpenfortUser | undefined> => {
      try {
        setOAuthState({ status: 'loading' });

        const result = await client.auth.initOAuth({
          provider: input.provider,
          redirectUri: input.redirectUri,
          disableSignup: input.disableSignup,
          isLegacyAppleIosBehaviorEnabled: input.isLegacyAppleIosBehaviorEnabled,
        });

        setOAuthState({ status: 'done' });
        callbacksRef.current?.onSuccess?.(result.user);

        return result.user;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('OAuth login failed');
        setOAuthState({
          status: 'error',
          error: errorObj
        });
        callbacksRef.current?.onError?.(errorObj);
        throw errorObj;
      }
    },
    [client, setOAuthState]
  );

  return {
    login,
    state: oAuthState,
  };
}