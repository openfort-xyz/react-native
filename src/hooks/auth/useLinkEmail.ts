/**
 * Hook for linking email accounts to existing users
 */
import { useCallback, useRef } from 'react';
import type { AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';
import type {
  EmailLinkHookOptions,
  EmailLinkHookResult,
} from '../../types';


/**
 * Hook for linking email/password authentication to existing authenticated users
 * 
 * This hook allows users who are already authenticated (via OAuth, SIWE, etc.) to add
 * email/password as an additional authentication method. The user must be logged in to use this hook.
 * 
 * @param opts - Configuration options including success/error callbacks
 * @returns Object with link function and current password flow state
 * 
 * @example
 * ```tsx
 * const { link, state } = useLinkEmail({
 *   onSuccess: (user) => console.log('Email linked successfully:', user),
 *   onError: (error) => console.error('Email linking failed:', error),
 * });
 * 
 * // Link email and password to current authenticated user
 * try {
 *   const result = await link({ 
 *     email: 'user@example.com',
 *     password: 'user-password'
 *   });
 *   
 *   if (result) {
 *     // Email linked successfully
 *   } else {
 *     // Email verification required - check your email
 *   }
 * } catch (error) {
 *   // Handle linking error (user not authenticated, email already linked, etc.)
 * }
 * ```
 */
export function useLinkEmail(opts?: EmailLinkHookOptions): EmailLinkHookResult {
  const { client, passwordState, setPasswordState, _internal } = useOpenfortContext();
  const callbacksRef = useRef(opts);
  callbacksRef.current = opts;

  const link = useCallback(
    async (credentials: { email: string; password: string }): Promise<OpenfortUser | undefined> => {
      try {
        setPasswordState({ status: 'sending-verification-code' });

        // Get current user access token
        const accessToken = await client.getAccessToken();
        if (!accessToken) {
          throw new Error('User must be authenticated to link email');
        }

        // Link email account
        const result = await client.auth.linkEmailPassword({
          email: credentials.email,
          password: credentials.password,
          authToken: accessToken,
        });

        // Check if action is required (email verification)
        if ('action' in result) {
          setPasswordState({
            status: 'awaiting-code-input',
          });
          // Return undefined as email verification is required
          return undefined;
        } else {
          // Link successful
          setPasswordState({ status: 'done' });
          // Refresh user state to reflect email linking
          await _internal.refreshUserState();
          callbacksRef.current?.onSuccess?.(result);
          return result;
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to link email and password');
        setPasswordState({
          status: 'error',
          error: errorObj
        });
        callbacksRef.current?.onError?.(errorObj);
        throw errorObj;
      }
    },
    [client, setPasswordState, _internal]
  );

  return {
    link,
    state: passwordState,
  };
}