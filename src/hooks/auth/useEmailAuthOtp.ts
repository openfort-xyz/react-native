import type { User } from '@openfort/openfort-js'
import { AuthenticationError, OpenfortError } from '@openfort/openfort-js'
import { useCallback, useState } from 'react'
import { useOpenfortContext } from '../../core/context'
import { onError, onSuccess } from '../../lib/hookConsistency'
import { type BaseFlowState, mapStatus } from '../../types/baseFlowState'
import type { OpenfortHookOptions } from '../../types/hookOption'

export type EmailOtpAuthResult = {
  error?: OpenfortError
  user?: User
}

export type LoginWithEmailOtpOptions = {
  email: string
  otp: string
} & OpenfortHookOptions<EmailOtpAuthResult>

export type RequestEmailOtpOptions = {
  email: string
} & OpenfortHookOptions<EmailOtpAuthResult>

export type UseEmailOtpHookOptions = OpenfortHookOptions<EmailOtpAuthResult>

export const useEmailAuthOtp = (hookOptions: UseEmailOtpHookOptions = {}) => {
  const { client, _internal } = useOpenfortContext()

  const [status, setStatus] = useState<BaseFlowState>({
    status: 'idle',
  })

  const signInEmailOtp = useCallback(
    async (options: LoginWithEmailOtpOptions): Promise<EmailOtpAuthResult> => {
      try {
        setStatus({
          status: 'loading',
        })

        if (!options.email || !options.otp) {
          const error = new AuthenticationError('validation_error', 'Email and OTP are required')
          setStatus({
            status: 'error',
            error,
          })
          return onError<EmailOtpAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        const result = await client.auth.logInWithEmailOtp({
          email: options.email,
          otp: options.otp,
        })

        setStatus({
          status: 'success',
        })
        const user = result.user

        await _internal.refreshUserState(user)
        return onSuccess<EmailOtpAuthResult>({
          data: { user },
          hookOptions,
          options,
        })
      } catch (e) {
        const error =
          e instanceof OpenfortError ? e : new AuthenticationError('email_otp_error', 'Failed to login with email OTP')

        setStatus({
          status: 'error',
          error: error,
        })

        return onError({
          hookOptions,
          options,
          error: error,
        })
      }
    },
    [client, setStatus, _internal, hookOptions]
  )

  const requestEmailOtp = useCallback(
    async (options: RequestEmailOtpOptions): Promise<EmailOtpAuthResult> => {
      try {
        setStatus({
          status: 'loading',
        })

        if (!options.email) {
          const error = new AuthenticationError('validation_error', 'Email is required')
          setStatus({
            status: 'error',
            error,
          })
          return onError<EmailOtpAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        await client.auth.requestEmailOtp({
          email: options.email,
        })

        setStatus({
          status: 'success',
        })
        return onSuccess<EmailOtpAuthResult>({
          data: {},
          hookOptions,
          options,
        })
      } catch (e) {
        const error =
          e instanceof OpenfortError ? e : new AuthenticationError('email_otp_error', 'Failed to request email OTP')

        setStatus({
          status: 'error',
          error: error,
        })

        return onError({
          hookOptions,
          options,
          error: error,
        })
      }
    },
    [client, setStatus, hookOptions]
  )

  const reset = () => {
    setStatus({ status: 'idle' })
  }

  return {
    requestEmailOtp,
    signInEmailOtp,
    reset,
    ...mapStatus(status),
  }
}
