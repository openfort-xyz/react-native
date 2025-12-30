import type { User } from '@openfort/openfort-js'
import { useCallback, useState } from 'react'
import { useOpenfortContext } from '../../core/context'
import { onError, onSuccess } from '../../lib/hookConsistency'
import { type BaseFlowState, mapStatus } from '../../types/baseFlowState'
import type { OpenfortHookOptions } from '../../types/hookOption'
import { OpenfortError, OpenfortErrorType } from '../../types/openfortError'

export type PhoneOtpAuthResult = {
  error?: OpenfortError
  user?: User
}

export type LoginWithPhoneOtpOptions = {
  phone: string
  otp: string
} & OpenfortHookOptions<PhoneOtpAuthResult>

export type RequestPhoneOtpOptions = {
  phone: string
} & OpenfortHookOptions<PhoneOtpAuthResult>

export type UsePhoneOtpHookOptions = OpenfortHookOptions<PhoneOtpAuthResult>

export const usePhoneAuthOtp = (hookOptions: UsePhoneOtpHookOptions = {}) => {
  const { client, _internal } = useOpenfortContext()

  const [status, setStatus] = useState<BaseFlowState>({
    status: 'idle',
  })

  const signInPhoneOtp = useCallback(
    async (options: LoginWithPhoneOtpOptions): Promise<PhoneOtpAuthResult> => {
      try {
        setStatus({
          status: 'loading',
        })

        if (!options.phone || !options.otp) {
          const error = new OpenfortError('Phone and OTP are required', OpenfortErrorType.AUTHENTICATION_ERROR)
          setStatus({
            status: 'error',
            error,
          })
          return onError<PhoneOtpAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        const result = await client.auth.logInWithPhoneOtp({
          phoneNumber: options.phone,
          otp: options.otp,
        })

        setStatus({
          status: 'success',
        })
        const user = result.user

        await _internal.refreshUserState(user)
        return onSuccess<PhoneOtpAuthResult>({
          data: { user },
          hookOptions,
          options,
        })
      } catch (e) {
        const error = new OpenfortError('Failed to login with phone OTP', OpenfortErrorType.AUTHENTICATION_ERROR, {
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

  const requestPhoneOtp = useCallback(
    async (options: RequestPhoneOtpOptions): Promise<PhoneOtpAuthResult> => {
      try {
        setStatus({
          status: 'loading',
        })

        if (!options.phone) {
          const error = new OpenfortError('Phone is required', OpenfortErrorType.AUTHENTICATION_ERROR)
          setStatus({
            status: 'error',
            error,
          })
          return onError<PhoneOtpAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        await client.auth.requestPhoneOtp({
          phoneNumber: options.phone,
        })

        setStatus({
          status: 'success',
        })
        return onSuccess<PhoneOtpAuthResult>({
          data: {},
          hookOptions,
          options,
        })
      } catch (e) {
        const error = new OpenfortError('Failed to request phone OTP', OpenfortErrorType.AUTHENTICATION_ERROR, {
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
    requestPhoneOtp,
    signInPhoneOtp,
    reset,
    ...mapStatus(status),
  }
}
