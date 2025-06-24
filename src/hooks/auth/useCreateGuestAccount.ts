/**
 * Hook for creating guest accounts
 */
import { useCallback, useRef } from 'react';
import type { AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';
import type {
  ErrorCallback,
  AuthSuccessCallback,
} from '../../types';

/**
 * Options for guest account creation hook
 */
export interface UseCreateGuestAccountOptions {
  onSuccess?: AuthSuccessCallback;
  onError?: ErrorCallback;
}

/**
 * Result interface for guest account creation hook
 */
export interface UseCreateGuestAccount {
  create: () => Promise<OpenfortUser>;
}

/**
 * Hook for creating guest accounts
 * 
 * Guest accounts allow users to access certain features without full authentication.
 * These accounts can later be upgraded to full accounts by linking authentication methods.
 * 
 * @param opts - Configuration options including success/error callbacks
 * @returns Object with create function
 * 
 * @example
 * ```tsx
 * const { create } = useCreateGuestAccount({
 *   onSuccess: (user) => console.log('Guest account created:', user),
 *   onError: (error) => console.error('Failed to create guest account:', error),
 * });
 * 
 * // Create a guest account
 * const guestUser = await create();
 * ```
 */
export function useCreateGuestAccount(opts?: UseCreateGuestAccountOptions): UseCreateGuestAccount {
  const { client } = useOpenfortContext();
  const callbacksRef = useRef(opts);
  callbacksRef.current = opts;

  const create = useCallback(
    async (): Promise<OpenfortUser> => {
      try {
        const result = await client.auth.signUpGuest();

        callbacksRef.current?.onSuccess?.(result.player);

        return result.player;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to create guest account');
        callbacksRef.current?.onError?.(errorObj);
        throw errorObj;
      }
    },
    [client]
  );

  return {
    create,
  };
}