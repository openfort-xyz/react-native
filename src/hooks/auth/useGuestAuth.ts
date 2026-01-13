import type { User as OpenfortUser } from '@openfort/openfort-js'
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
 * Hook for guest account authentication.
 *
 * This hook provides functionality for creating anonymous guest accounts that allow
 * users to access features without full authentication. Guest accounts can later be
 * upgraded to permanent accounts by linking email, OAuth, or wallet authentication.
 *
 * @param hookOptions - Configuration options including success and error callbacks
 * @returns Guest authentication method and flow state including:
 *   - `signUpGuest` - Create anonymous guest account
 *   - `isLoading` - Whether guest account creation is in progress
 *   - `isError` - Whether guest account creation failed
 *   - `isSuccess` - Whether guest account was created successfully
 *   - `error` - Error from the last failed operation
 *
 * @example
 * ```tsx
 * const { signUpGuest, isLoading } = useGuestAuth({
 *   onSuccess: ({ user }) => console.log('Guest account created:', user?.id),
 *   onError: ({ error }) => console.error('Failed to create guest account:', error),
 * });
 *
 * // Create guest account for anonymous access
 * if (!isLoading) {
 *   await signUpGuest();
 * }
 *
 * // Later, upgrade to permanent account by linking authentication
 * // Use linkEmail, linkOauth, or linkSiwe from other hooks
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

        const user = result.user

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
