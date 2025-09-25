
import type { AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js';
import { useCallback } from 'react';
import { useOpenfortContext } from '../../core/context';
import { onError, onSuccess } from '../../lib/hookConsistency';
import { OpenfortHookOptions } from '../../types/hookOption';
import { OpenfortError, OpenfortErrorType } from '../../types/openfortError';
import { CreateWalletPostAuthOptions } from './useCreateWalletPostAuth';
import { PasswordFlowState } from '../../types';


export type EmailAuthResult = {
  error?: OpenfortError;
  user?: OpenfortUser;
  // wallet?: UserWallet;
  requiresEmailVerification?: boolean;
};

export type SignInEmailOptions = {
  email: string;
  password: string;
  emailVerificationRedirectTo?: string;
} & OpenfortHookOptions<EmailAuthResult> & CreateWalletPostAuthOptions;

export type SignUpEmailOptions = {
  email: string;
  password: string;
  name?: string;
  emailVerificationRedirectTo?: string;
} & OpenfortHookOptions<EmailAuthResult> & CreateWalletPostAuthOptions;

export type RequestResetPasswordOptions = {
  email: string;
  emailVerificationRedirectTo?: string;
} & OpenfortHookOptions<EmailAuthResult>;

export type ResetPasswordOptions = {
  email: string;
  password: string;
  state: string;
} & OpenfortHookOptions<EmailAuthResult>;

export type LinkEmailOptions = {
  email: string;
  password: string;
  emailVerificationRedirectTo?: string;
} & OpenfortHookOptions<EmailAuthResult>;

export type VerifyEmailOptions = {
  email: string;
  state: string;
} & OpenfortHookOptions<EmailVerificationResult>;

export type EmailVerificationResult = {
  email?: string,
  error?: OpenfortError
}

export type UseEmailHookOptions = {
  emailVerificationRedirectTo?: string;
} & OpenfortHookOptions<EmailAuthResult | EmailVerificationResult> & CreateWalletPostAuthOptions;


const mapStatus = (status: PasswordFlowState) => {
  return {
    isLoading: status.status === 'submitting-code' || status.status === 'sending-verification-code',
    isError: status.status === 'error',
    isSuccess: status.status === 'done',
    requiresEmailVerification: status.status === 'awaiting-code-input',
    error: "error" in status ? status.error : null,
  }
}

/**
 * Hook for email and password authentication
 *
 * This hook provides email/password authentication flows including sign-in, sign-up, linking accounts,
 * and password reset functionality. It handles email verification flows automatically.
 *
 * @param hookOptions - Optional configuration with callback functions and email verification settings
 * @returns Email authentication state and methods with flow status indicators
 *
 * @example
 * ```tsx
 * const { signInEmail, signUpEmail, linkEmail, isLoading, requiresEmailVerification } = useEmailAuth({
 *   onSuccess: ({ user }) => console.log('Email auth successful:', user?.id),
 *   onError: ({ error }) => console.error('Email auth failed:', error?.message),
 * });
 *
 * // Sign up with email
 * const result = await signUpEmail({
 *   email: 'user@example.com',
 *   password: 'securePassword123',
 *   name: 'John Doe',
 * });
 *
 * // Handle email verification if required
 * if (requiresEmailVerification) {
 *   console.log('Check email for verification code');
 * }
 *
 * // Sign in with existing account
 * await signInEmail({
 *   email: 'user@example.com',
 *   password: 'securePassword123',
 * });
 * ```
 */
export const useEmailAuth = (hookOptions: UseEmailHookOptions = {}) => {
  const { client, setPasswordState, _internal, passwordState } = useOpenfortContext();

  const signInEmail = useCallback(async (options: SignInEmailOptions): Promise<EmailAuthResult> => {
    try {
      setPasswordState({ status: 'sending-verification-code' });

      // Login with email and password
      const result = await client.auth.logInWithEmailPassword({
        email: options.email,
        password: options.password,
      });

      // Check if action is required (email verification)
      if ('action' in result) {
        setPasswordState({
          status: 'awaiting-code-input',
        });
        // Return undefined as email verification is required
        return onSuccess({
          hookOptions,
          options,
          data: { requiresEmailVerification: true },
        })
      } else {
        // Login successful
        setPasswordState({ status: 'done' });
        const user = result.player;
        // Refresh user state in provider
        await _internal.refreshUserState(user);
        return onSuccess({
          hookOptions,
          options,
          data: { user },
        });
      }
    } catch (e) {
      const error = new OpenfortError('Failed to login with email and password', OpenfortErrorType.AUTHENTICATION_ERROR, { error: e });
      setPasswordState({
        status: 'error',
        error
      });
      return onError({
        hookOptions,
        options,
        error
      });
    }
  },
    [client, setPasswordState, _internal, hookOptions]
  );

  const signUpEmail = useCallback(async (options: SignUpEmailOptions): Promise<EmailAuthResult> => {
    try {
      setPasswordState({ status: 'sending-verification-code' });

      // Sign up with email and password
      const result = await client.auth.signUpWithEmailPassword({
        email: options.email,
        password: options.password,
        ...(options.name && { name: options.name }),
      });

      // Check if action is required (email verification)
      if ('action' in result) {
        setPasswordState({
          status: 'awaiting-code-input',
        });
        // Return undefined as email verification is required
        return onSuccess({
          hookOptions,
          options,
          data: { requiresEmailVerification: true },
        });
      } else {
        // Signup successful
        setPasswordState({ status: 'done' });
        const user = result.player;
        // Refresh user state in provider
        await _internal.refreshUserState(user);
        return onSuccess({
          hookOptions,
          options,
          data: { user },
        });
      }
    } catch (e) {
      const error = new OpenfortError('Failed to signup with email and password', OpenfortErrorType.AUTHENTICATION_ERROR, { error: e });
      setPasswordState({
        status: 'error',
        error
      });
      return onError({
        hookOptions,
        options,
        error
      });
    }
  },
    [client, setPasswordState, _internal, hookOptions]
  );

  const linkEmail = useCallback(async (options: LinkEmailOptions): Promise<EmailAuthResult> => {
    try {
      setPasswordState({ status: 'sending-verification-code' });

      // Get current user access token
      const accessToken = await client.getAccessToken();
      if (!accessToken) {
        throw new Error('User must be authenticated to link email');
      }

      // Link email account
      const result = await client.auth.linkEmailPassword({
        email: options.email,
        password: options.password,
        authToken: accessToken,
      });

      // Check if action is required (email verification)
      if ('action' in result) {
        setPasswordState({
          status: 'awaiting-code-input',
        });
        // Return undefined as email verification is required
        return onSuccess({
          hookOptions,
          options,
          data: { requiresEmailVerification: true },
        });
      } else {
        // Link successful
        setPasswordState({ status: 'done' });
        // Refresh user state to reflect email linking
        await _internal.refreshUserState();
        return onSuccess({
          hookOptions,
          options,
          data: { user: result },
        });
      }
    } catch (e) {
      const error = new OpenfortError('Failed to link email and password', OpenfortErrorType.AUTHENTICATION_ERROR, { error: e });
      setPasswordState({
        status: 'error',
        error
      });
      return onError({
        hookOptions,
        options,
        error
      });
    }
  }, [client, setPasswordState, _internal, hookOptions]);

  const verifyEmail = () => { } // TODO

  const resetPassword = () => { } // TODO

  const requestResetPassword = () => { } // TODO

  const reset = () => {
    setPasswordState({ status: 'initial' });
  };

  return {
    signInEmail,
    signUpEmail,
    verifyEmail,
    linkEmail,
    requestResetPassword,
    resetPassword,
    reset,
    ...mapStatus(passwordState),
  };
}