/**
 * Hook for email-based login functionality
 */
import { useCallback, useRef } from 'react';
import type { AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';
import type {
  PasswordLoginHookOptions,
  PasswordLoginHookResult,
  ErrorCallback,
  AuthSuccessCallback,
} from '../../types';

/**
 * Options for email login hook
 */
export type LoginWithEmailOptions = PasswordLoginHookOptions<{
  email: string;
}>;

/**
 * Result interface for email login hook
 */
export type LoginWithEmailHookResult = PasswordLoginHookResult<
  {
    email: string;
    password: string;
  },
  {
    code: string;
    email: string;
    password: string;
  }
>;

/**
 * Hook for logging in users with email and OTP verification
 * 
 * @param opts - Configuration options including success/error callbacks
 * @returns Object with sendCode and loginWithCode functions plus current state
 * 
 * @example
 * ```tsx
 * const { sendCode, loginWithCode, state } = useLoginWithEmail({
 *   onSuccess: (user) => console.log('Login successful:', user),
 *   onError: (error) => console.error('Login failed:', error),
 * });
 * 
 * // Send OTP code to email
 * await sendCode({ email: 'user@example.com' });
 * 
 * // Verify code and complete login
 * await loginWithCode({ 
 *   code: '123456',
 *   email: 'user@example.com' 
 * });
 * ```
 */
export function useLoginWithEmail(opts?: LoginWithEmailOptions): LoginWithEmailHookResult {
  const { client, passwordState, setPasswordState } = useOpenfortContext();
  const callbacksRef = useRef(opts);
  callbacksRef.current = opts;

  const signUp = useCallback(
    async (input: { email: string, password: string }) => {
      try {
        setPasswordState({ status: 'sending-code' });

        await client.auth.signUpWithEmailPassword({
          email: input.email,
          password: input.password,
        });

        setPasswordState({
          status: 'awaiting-code-input',
          email: input.email,
        });
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to send email code');
        setPasswordState({
          status: 'error',
          error: errorObj
        });
        callbacksRef.current?.onError?.(errorObj);
        throw errorObj;
      }
    },
    [client, setPasswordState]
  );

  const login = useCallback(
    async (input: {
      password: string;
      email: string;
    }): Promise<OpenfortUser> => {
      try {
        setPasswordState({ status: 'submitting-code' });

        const email = input.email || (passwordState.status === 'awaiting-code-input' ? passwordState.email : '');
        if (!email) {
          throw new Error('Email is required for login');
        }

        const result = await client.auth.logInWithEmailPassword({
          email,
          password: input.password,
        });

        setPasswordState({ status: 'done' });
        callbacksRef.current?.onSuccess?.(result.player);

        return result.user;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to login with email');
        setPasswordState({
          status: 'error',
          error: errorObj
        });
        callbacksRef.current?.onError?.(errorObj);
        throw errorObj;
      }
    },
    [client, passwordState, setPasswordState]
  );

  return {
    signUp,
    login,
    state: passwordState,
  };
}