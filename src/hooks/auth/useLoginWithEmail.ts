/**
 * Hook for email-based authentication (login and signup)
 */
import { useCallback, useRef } from 'react';
import type { AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';
import type {
  EmailLoginHookOptions,
  EmailLoginHookResult,
} from '../../types';


/**
 * Hook for email-based authentication (login and signup)
 * 
 * This hook provides both login and signup functionality using email/password.
 * It handles email verification when required and provides clear feedback.
 * 
 * @param opts - Configuration options including success/error callbacks
 * @returns Object with login, signup functions and current password flow state
 * 
 * @example
 * ```tsx
 * const { login, signup, state } = useLoginWithEmail({
 *   onSuccess: (user) => console.log('Authentication successful:', user),
 *   onError: (error) => console.error('Authentication failed:', error),
 * });
 * 
 * // Sign up a new user
 * try {
 *   const user = await signup({ 
 *     email: 'user@example.com',
 *     password: 'user-password',
 *     name: 'John Doe' // optional
 *   });
 *   
 *   if (user) {
 *     // Signup successful, user is authenticated
 *   } else {
 *     // Email verification required - check your email
 *   }
 * } catch (error) {
 *   // Handle signup error (email already exists, weak password, etc.)
 * }
 * 
 * // Login existing user
 * try {
 *   const user = await login({ 
 *     email: 'user@example.com',
 *     password: 'user-password'
 *   });
 *   
 *   if (user) {
 *     // Login successful, user is authenticated
 *   } else {
 *     // Email verification required - check your email
 *   }
 * } catch (error) {
 *   // Handle login error (invalid credentials, etc.)
 * }
 * ```
 */
export function useLoginWithEmail(opts?: EmailLoginHookOptions): EmailLoginHookResult {
  const { client, passwordState, setPasswordState, _internal } = useOpenfortContext();
  const callbacksRef = useRef(opts);
  callbacksRef.current = opts;

  const login = useCallback(
    async (credentials: { email: string; password: string }): Promise<OpenfortUser | undefined> => {
      try {
        setPasswordState({ status: 'sending-verification-code' });

        // Login with email and password
        const result = await client.auth.logInWithEmailPassword({
          email: credentials.email,
          password: credentials.password,
        });

        // Check if action is required (email verification)
        if ('action' in result) {
          setPasswordState({
            status: 'awaiting-code-input',
          });
          // Return undefined as email verification is required
          return undefined;
        } else {
          // Login successful
          setPasswordState({ status: 'done' });
          const user = result.player;
          // Refresh user state in provider
          await _internal.refreshUserState(user);
          callbacksRef.current?.onSuccess?.(user, false);
          return user;
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to login with email and password');
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

  const signup = useCallback(
    async (credentials: { email: string; password: string; name?: string }): Promise<OpenfortUser | undefined> => {
      try {
        setPasswordState({ status: 'sending-verification-code' });

        // Sign up with email and password
        const result = await client.auth.signUpWithEmailPassword({
          email: credentials.email,
          password: credentials.password,
          ...(credentials.name && { name: credentials.name }),
        });

        // Check if action is required (email verification)
        if ('action' in result) {
          setPasswordState({
            status: 'awaiting-code-input',
          });
          // Return undefined as email verification is required
          return undefined;
        } else {
          // Signup successful
          setPasswordState({ status: 'done' });
          const user = result.player;
          // Refresh user state in provider
          await _internal.refreshUserState(user);
          callbacksRef.current?.onSuccess?.(user, true); // true indicates new user
          return user;
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to signup with email and password');
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
    login,
    signup,
    state: passwordState,
  };
}