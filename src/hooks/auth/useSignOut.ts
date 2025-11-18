import { useCallback, useState } from 'react'
import { useOpenfortContext } from '../../core'
import { onError, onSuccess } from '../../lib/hookConsistency'
import { type BaseFlowState, mapStatus } from '../../types/baseFlowState'
import type { OpenfortHookOptions } from '../../types/hookOption'
import { OpenfortError, OpenfortErrorType } from '../../types/openfortError'
import { useOpenfortClient } from '../core'

/**
 * Hook for user sign out functionality
 *
 * This hook provides secure sign out capabilities that clear user authentication state
 * and refresh the application context to reflect the unauthenticated state.
 *
 * @param hookOptions - Optional configuration with callback functions for handling success and error events
 * @returns Sign out method with loading and error state indicators
 *
 * @example
 * ```tsx
 * const { signOut, isLoading, isError, error } = useSignOut({
 *   onSuccess: () => console.log('Successfully signed out'),
 *   onError: ({ error }) => console.error('Sign out failed:', error?.message),
 * });
 *
 * // Sign out the current user
 * if (!isLoading) {
 *   await signOut();
 * }
 *
 * // Handle loading states
 * if (isLoading) {
 *   console.log('Signing out...');
 * }
 *
 * // Handle errors
 * if (isError && error) {
 *   console.error('Sign out error:', error.message);
 * }
 * ```
 */
export function useSignOut(hookOptions: OpenfortHookOptions = {}) {
  const client = useOpenfortClient()
  const { _internal, user } = useOpenfortContext()
  const [status, setStatus] = useState<BaseFlowState>({
    status: 'idle',
  })

  const signOut = useCallback(
    async (options: OpenfortHookOptions = {}) => {
      if (!user) return

      setStatus({
        status: 'loading',
      })
      try {
        await client.auth.logout()
        _internal.refreshUserState()
        setStatus({
          status: 'success',
        })

        return onSuccess({
          hookOptions,
          options,
          data: {},
        })
      } catch (e) {
        const error = new OpenfortError('Failed to sign out', OpenfortErrorType.AUTHENTICATION_ERROR, { error: e })
        setStatus({
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
    [client, user, _internal.refreshUserState, setStatus, hookOptions]
  )

  return {
    ...mapStatus(status),
    signOut,
  }
}
