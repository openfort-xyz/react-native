import type { User } from '@openfort/openfort-js'
import { useCallback, useState } from 'react'
import { useOpenfortContext } from '../../core/context'
import { onError, onSuccess } from '../../lib/hookConsistency'
import { type BaseFlowState, mapStatus } from '../../types/baseFlowState'
import type { OpenfortHookOptions } from '../../types/hookOption'
import { OpenfortError, OpenfortErrorType } from '../../types/openfortError'

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
          const error = new OpenfortError('Email and OTP are required', OpenfortErrorType.AUTHENTICATION_ERROR)
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
        const error = new OpenfortError('Failed to login with email OTP', OpenfortErrorType.AUTHENTICATION_ERROR, {
          error: e,
        })

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
          const error = new OpenfortError('Email is required', OpenfortErrorType.AUTHENTICATION_ERROR)
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
        const error = new OpenfortError('Failed to request email OTP', OpenfortErrorType.AUTHENTICATION_ERROR, {
          error: e,
        })

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
