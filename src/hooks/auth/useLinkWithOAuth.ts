/**
 * Hook for linking OAuth accounts to existing users
 */
import { useCallback, useRef } from 'react';
import type { AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';
import type {
  OAuthFlowState,
  OAuthHookOptions,
  LinkWithOAuthInput,
  UseLinkWithOAuth,
} from '../../types';

/**
 * Hook for linking OAuth accounts to existing authenticated users
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
 * // Link with Google
 * await link({ provider: 'google' });
 * 
 * // Link with Apple (using legacy web flow on iOS)
 * await link({ 
 *   provider: 'apple',
 *   isLegacyAppleIosBehaviorEnabled: true 
 * });
 * ```
 */
export function useLinkWithOAuth(opts?: OAuthHookOptions): UseLinkWithOAuth {
  const { client, oAuthState, setOAuthState } = useOpenfortContext();
  const callbacksRef = useRef(opts);
  callbacksRef.current = opts;

  const link = useCallback(
    async (input: LinkWithOAuthInput): Promise<OpenfortUser | undefined> => {
      try {
        setOAuthState({ status: 'loading' });

        const result = await client.auth.initLinkOAuth({
          provider: input.provider,
          redirectUri: input.redirectUri,
          isLegacyAppleIosBehaviorEnabled: input.isLegacyAppleIosBehaviorEnabled,
        });

        setOAuthState({ status: 'done' });
        callbacksRef.current?.onSuccess?.(result.user);

        return result.user;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('OAuth linking failed');
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
    link,
    state: oAuthState,
  };
}