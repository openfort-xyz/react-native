import type { AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js'
import { useCallback, useState } from 'react'
import { useOpenfortContext } from '../../core/context'
import { onError, onSuccess } from '../../lib/hookConsistency'
import { type BaseFlowState, mapStatus } from '../../types/baseFlowState'
import type { OpenfortHookOptions } from '../../types/hookOption'
import { OpenfortError, OpenfortErrorType } from '../../types/openfortError'

export type GuestHookResult = {
  error?: OpenfortError
  user?: OpenfortUser
  // wallet?: UserWallet;
}

export type GuestHookOptions = OpenfortHookOptions<GuestHookResult>

/**
 * Hook for creating guest accounts.
 *
 * Guest accounts allow users to access certain features without full authentication and can later be upgraded to full accounts
 * by linking additional authentication methods.
 *
 * @param hookOptions - Configuration options including success and error callbacks.
 * @returns Current guest authentication helpers with flow status indicators.
 *
 * @example
 * ```tsx
 * const { signUpGuest, isLoading } = useGuestAuth({
 *   onSuccess: ({ user }) => console.log('Guest account created:', user),
 *   onError: ({ error }) => console.error('Failed to create guest account:', error),
 * });
 *
 * if (!isLoading) {
 *   await signUpGuest();
 * }
 * ```
 */
export const useGuestAuth = (hookOptions: GuestHookOptions = {}) => {
  const { client, _internal } = useOpenfortContext()
  const { refreshUserState: updateUser } = _internal

  const [status, setStatus] = useState<BaseFlowState>({
    status: 'idle',
  })
  // const { tryUseWallet } = useCreateWalletPostAuth();

  const signUpGuest = useCallback(
    async (options: GuestHookOptions = {}): Promise<GuestHookResult> => {
      try {
        setStatus({
          status: 'loading',
        })

        const result = await client.auth.signUpGuest()

        const user = result.player
        await updateUser(user)

        // const { wallet } = await tryUseWallet({
        //   logoutOnError: options.logoutOnError || hookOptions.logoutOnError,
        //   automaticRecovery: options.automaticRecovery || hookOptions.automaticRecovery,
        // });

        setStatus({
          status: 'success',
        })

        onSuccess({
          hookOptions,
          options,
          data: { user },
        })

        return { user /* wallet */ }
      } catch (error) {
        const openfortError = new OpenfortError('Failed to signup guest', OpenfortErrorType.AUTHENTICATION_ERROR, {
          error,
        })

        setStatus({
          status: 'error',
          error: openfortError,
        })

        return onError({
          hookOptions,
          options,
          error: openfortError,
        })
      }
    },
    [client, setStatus, updateUser, hookOptions]
  )

  return {
    signUpGuest,
    ...mapStatus(status),
  }
}
