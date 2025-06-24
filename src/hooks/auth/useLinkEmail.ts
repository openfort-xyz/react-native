/**
 * Hook for linking email accounts to existing users
 */
import { useCallback, useRef } from 'react';
import type { AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';
import type {
  PasswordLinkHookOptions,
  PasswordLinkHookResult,
} from '../../types';

/**
 * Options for email linking hook
 */
export type LinkWithEmailOptions = PasswordLinkHookOptions<{
  email: string;
}>;

/**
 * Result interface for email linking hook
 */
export type LinkWithEmailHookResult = PasswordLinkHookResult<
  {
    email: string;
  },
  {
    code: string;
    email?: string;
  }
>;

/**
 * Hook for linking email accounts to existing authenticated users
 * 
 * @param opts - Configuration options including success/error callbacks
 * @returns Object with sendCode and linkWithCode functions plus current state
 * 
 * @example
 * ```tsx
 * const { sendCode, linkWithCode, state } = useLinkEmail({
 *   onSuccess: (user) => console.log('Email linked successfully:', user),
 *   onError: (error) => console.error('Email linking failed:', error),
 * });
 * 
 * // Send OTP code to email
 * await sendCode({ email: 'user@example.com' });
 * 
 * // Verify code and complete linking
 * await linkWithCode({ 
 *   code: '123456',
 *   email: 'user@example.com' 
 * });
 * ```
 */
export function useLinkEmail(opts?: LinkWithEmailOptions): LinkWithEmailHookResult {
  const { client, passwordState, setPasswordState } = useOpenfortContext();
  const callbacksRef = useRef(opts);
  callbacksRef.current = opts;

  const link = useCallback(
    async (input: { email: string }) => {
      try {
        setPasswordState({ status: '' });

        await client.auth.linkEmailPassword({
          email: input.email,
          action: 'link',
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

  const linkWithCode = useCallback(
    async (input: {
      code: string;
      email?: string;
    }): Promise<OpenfortUser> => {
      try {
        setPasswordState({ status: 'submitting-code' });

        const email = input.email || (passwordState.status === 'awaiting-code-input' ? passwordState.email : '');
        if (!email) {
          throw new Error('Email is required for linking');
        }

        const result = await client.auth.linkWithEmail({
          email,
          code: input.code,
        });

        setPasswordState({ status: 'done' });
        callbacksRef.current?.onSuccess?.(result.user);

        return result.user;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to link email');
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
    sendCode,
    linkWithCode,
    state: passwordState,
  };
}