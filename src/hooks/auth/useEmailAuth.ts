import type { User as OpenfortUser } from '@openfort/openfort-js'
import { useCallback } from 'react'
import { useOpenfortContext } from '../../core/context'
import { onError, onSuccess } from '../../lib/hookConsistency'
import { createOAuthRedirectUri } from '../../native/oauth'
import type { PasswordFlowState } from '../../types'
import type { OpenfortHookOptions } from '../../types/hookOption'
import { OpenfortError, OpenfortErrorType } from '../../types/openfortError'

export type EmailAuthResult = {
  error?: OpenfortError
  user?: OpenfortUser
  // wallet?: UserWallet;
  requiresEmailVerification?: boolean
}

export type SignInEmailOptions = {
  email: string
  password: string
  emailVerificationRedirectTo?: string
} & OpenfortHookOptions<EmailAuthResult>

export type SignUpEmailOptions = {
  email: string
  password: string
  name?: string
  emailVerificationRedirectTo?: string
} & OpenfortHookOptions<EmailAuthResult>

export type RequestResetPasswordOptions = {
  email: string
  emailVerificationRedirectTo?: string
} & OpenfortHookOptions<EmailAuthResult>

export type ResetPasswordOptions = {
  password: string
  token: string
} & OpenfortHookOptions<EmailAuthResult>

export type LinkEmailOptions = {
  email: string
  password: string
  emailVerificationRedirectTo?: string
} & OpenfortHookOptions<EmailAuthResult>

export type VerifyEmailOptions = {
  token: string
} & OpenfortHookOptions<EmailVerificationResult>

export type EmailVerificationResult = {
  email?: string
  error?: OpenfortError
}

export type UseEmailHookOptions = {
  emailVerificationRedirectTo?: string
} & OpenfortHookOptions<EmailAuthResult | EmailVerificationResult>

const mapStatus = (status: PasswordFlowState) => {
  return {
    isLoading: status.status === 'submitting-code' || status.status === 'sending-verification-code',
    isError: status.status === 'error',
    isSuccess: status.status === 'done',
    requiresEmailVerification: status.status === 'awaiting-code-input',
    error: 'error' in status ? status.error : null,
  }
}

/**
 * Hook for email and password authentication.
 *
 * This hook provides comprehensive email/password authentication flows including sign-in,
 * sign-up, account linking, password reset, and email verification functionality.
 *
 * @param hookOptions - Optional configuration with callback functions and email verification settings
 * @returns Email authentication state and methods with flow status indicators including:
 *   - `signInEmail` - Sign in with email and password
 *   - `signUpEmail` - Create new account with email and password
 *   - `linkEmail` - Link email/password to existing authenticated account
 *   - `requestResetPassword` - Request password reset email
 *   - `resetPassword` - Complete password reset with token from email
 *   - `verifyEmail` - Verify email address with verification code
 *   - `reset` - Reset flow state to initial
 *   - `isLoading` - Whether an operation is in progress
 *   - `isError` - Whether the last operation failed
 *   - `isSuccess` - Whether the last operation succeeded
 *   - `requiresEmailVerification` - Whether email verification is pending
 *   - `error` - Error from the last failed operation
 *
 * @example
 * ```tsx
 * const { signInEmail, signUpEmail, linkEmail, isLoading, requiresEmailVerification } = useEmailAuth({
 *   onSuccess: ({ user }) => console.log('Email auth successful:', user?.id),
 *   onError: ({ error }) => console.error('Email auth failed:', error?.message),
 * });
 *
 * // Sign up a new user
 * await signUpEmail({ email: 'user@example.com', password: 'securePassword123' });
 *
 * if (requiresEmailVerification) {
 *   console.log('Check email for verification code');
 * }
 *
 * // Sign in existing user
 * await signInEmail({ email: 'user@example.com', password: 'securePassword123' });
 * ```
 */
export const useEmailAuth = (hookOptions: UseEmailHookOptions = {}) => {
  const { client, setPasswordState, _internal, passwordState } = useOpenfortContext()

  const signInEmail = useCallback(
    async (options: SignInEmailOptions): Promise<EmailAuthResult> => {
      try {
        setPasswordState({ status: 'sending-verification-code' })

        // Login with email and password
        const result = await client.auth.logInWithEmailPassword({
          email: options.email,
          password: options.password,
        })

        // Check if action is required (email verification)
        if ('action' in result) {
          setPasswordState({
            status: 'awaiting-code-input',
          })
          // Return undefined as email verification is required
          return onSuccess({
            hookOptions,
            options,
            data: { requiresEmailVerification: true },
          })
        } else {
          // Login successful
          setPasswordState({ status: 'done' })
          const user = result.user
          // Refresh user state in provider
          await _internal.refreshUserState(user)
          return onSuccess({
            hookOptions,
            options,
            data: { user },
          })
        }
      } catch (e) {
        const error = new OpenfortError(
          'Failed to login with email and password',
          OpenfortErrorType.AUTHENTICATION_ERROR,
          { error: e }
        )
        setPasswordState({
          status: 'error',
          error,
        })
        return onError({
          hookOptions,
          options,
          error,
        })
      }
    },
    [client, setPasswordState, _internal, hookOptions]
  )

  const signUpEmail = useCallback(
    async (options: SignUpEmailOptions): Promise<EmailAuthResult> => {
      try {
        setPasswordState({ status: 'sending-verification-code' })

        // Sign up with email and password
        const result = await client.auth.signUpWithEmailPassword({
          email: options.email,
          password: options.password,
          callbackURL: options.emailVerificationRedirectTo || createOAuthRedirectUri(),
          ...(options.name && { name: options.name }),
        })

        // Check if action is required (email verification)
        if ('action' in result) {
          setPasswordState({
            status: 'awaiting-code-input',
          })
          // Return undefined as email verification is required
          return onSuccess({
            hookOptions,
            options,
            data: { requiresEmailVerification: true },
          })
        } else {
          // Signup successful
          setPasswordState({ status: 'done' })
          const user = result.user
          // Refresh user state in provider
          await _internal.refreshUserState(user)
          return onSuccess({
            hookOptions,
            options,
            data: { user },
          })
        }
      } catch (e) {
        const error = new OpenfortError(
          'Failed to signup with email and password',
          OpenfortErrorType.AUTHENTICATION_ERROR,
          { error: e }
        )
        setPasswordState({
          status: 'error',
          error,
        })
        return onError({
          hookOptions,
          options,
          error,
        })
      }
    },
    [client, setPasswordState, _internal, hookOptions]
  )

  // TODO: Auth V2
  // const linkEmail = useCallback(
  //   async (options: LinkEmailOptions): Promise<EmailAuthResult> => {
  //     try {
  //       setPasswordState({ status: 'sending-verification-code' })

  //       // Get current user access token
  //       const accessToken = await client.getAccessToken()
  //       if (!accessToken) {
  //         throw new Error('User must be authenticated to link email')
  //       }

  //       // Link email account
  //       const result = await client.auth.linkEmailPassword({
  //         email: options.email,
  //         password: options.password,
  //         authToken: accessToken,
  //       })

  //       // Check if action is required (email verification)
  //       if ('action' in result) {
  //         setPasswordState({
  //           status: 'awaiting-code-input',
  //         })
  //         // Return undefined as email verification is required
  //         return onSuccess({
  //           hookOptions,
  //           options,
  //           data: { requiresEmailVerification: true },
  //         })
  //       } else {
  //         // Link successful
  //         setPasswordState({ status: 'done' })
  //         // Refresh user state to reflect email linking
  //         await _internal.refreshUserState()
  //         return onSuccess({
  //           hookOptions,
  //           options,
  //           data: { user: result },
  //         })
  //       }
  //     } catch (e) {
  //       const error = new OpenfortError('Failed to link email and password', OpenfortErrorType.AUTHENTICATION_ERROR, {
  //         error: e,
  //       })
  //       setPasswordState({
  //         status: 'error',
  //         error,
  //       })
  //       return onError({
  //         hookOptions,
  //         options,
  //         error,
  //       })
  //     }
  //   },
  //   [client, setPasswordState, _internal, hookOptions]
  // )

  const requestResetPassword = useCallback(
    async (options: RequestResetPasswordOptions): Promise<EmailAuthResult> => {
      try {
        setPasswordState({ status: 'sending-verification-code' })

        // Request password reset email
        await client.auth.requestResetPassword({
          email: options.email,
          redirectUrl: options.emailVerificationRedirectTo || createOAuthRedirectUri('/password/reset'),
        })

        setPasswordState({ status: 'awaiting-code-input' })

        return onSuccess({
          hookOptions,
          options,
          data: { requiresEmailVerification: true },
        })
      } catch (e) {
        const error = new OpenfortError('Failed to request password reset', OpenfortErrorType.AUTHENTICATION_ERROR, {
          error: e,
        })
        setPasswordState({
          status: 'error',
          error,
        })
        return onError({
          hookOptions,
          options,
          error,
        })
      }
    },
    [client, setPasswordState, hookOptions]
  )

  const resetPassword = useCallback(
    async (options: ResetPasswordOptions): Promise<EmailAuthResult> => {
      try {
        setPasswordState({ status: 'submitting-code' })

        // Reset password with new password and state token
        await client.auth.resetPassword({
          password: options.password,
          token: options.token,
        })

        setPasswordState({ status: 'done' })

        return onSuccess({
          hookOptions,
          options,
          data: {},
        })
      } catch (e) {
        const error = new OpenfortError('Failed to reset password', OpenfortErrorType.AUTHENTICATION_ERROR, {
          error: e,
        })
        setPasswordState({
          status: 'error',
          error,
        })
        return onError({
          hookOptions,
          options,
          error,
        })
      }
    },
    [client, setPasswordState, hookOptions]
  )

  const verifyEmail = useCallback(
    async (options: VerifyEmailOptions): Promise<EmailVerificationResult> => {
      try {
        setPasswordState({ status: 'submitting-code' })

        // Verify email with state token
        await client.auth.verifyEmail({
          token: options.token,
        })

        setPasswordState({ status: 'done' })

        return onSuccess({
          hookOptions,
          options,
          data: {},
        })
      } catch (e) {
        const error = new OpenfortError('Failed to verify email', OpenfortErrorType.AUTHENTICATION_ERROR, { error: e })
        setPasswordState({
          status: 'error',
          error,
        })
        return onError({
          hookOptions,
          options,
          error,
        })
      }
    },
    [client, setPasswordState, hookOptions]
  )

  const reset = () => {
    setPasswordState({ status: 'initial' })
  }

  return {
    signInEmail,
    signUpEmail,
    verifyEmail,
    linkEmail: () => {},
    requestResetPassword,
    resetPassword,
    reset,
    ...mapStatus(passwordState),
  }
}
