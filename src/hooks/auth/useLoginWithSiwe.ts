/**
 * Hook for Sign-In with Ethereum (SIWE) login functionality
 */
import { useCallback, useRef } from 'react';
import type { AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';
import type {
  SiweFlowState,
  ErrorCallback,
  AuthSuccessCallback,
  GenerateSiweMessage,
} from '../../types';

/**
 * Options for SIWE login hook
 */
export interface UseLoginWithSiweOptions {
  onError?: ErrorCallback;
  onSuccess?: AuthSuccessCallback;
  onGenerateMessage?: (message: string) => void;
}

/**
 * Result interface for SIWE login hook
 */
export interface UseLoginWithSiwe {
  generateSiweMessage: GenerateSiweMessage;
  state: SiweFlowState;
  loginWithSiwe: (opts: {
    /** Signature generated against standard Sign-In With Ethereum message */
    signature: string;
    /**
     * Optional SIWE message, only needed if the message differs from the one in memory 
     * that was cached in previous call to `generateMessage`
     */
    messageOverride?: string;
    disableSignup?: boolean;
  }) => Promise<OpenfortUser>;
}

/**
 * Hook for logging in users with Sign-In with Ethereum (SIWE)
 * 
 * @param opts - Configuration options including success/error callbacks
 * @returns Object with generateSiweMessage, loginWithSiwe functions plus current state
 * 
 * @example
 * ```tsx
 * const { generateSiweMessage, loginWithSiwe, state } = useLoginWithSiwe({
 *   onSuccess: (user) => console.log('SIWE login successful:', user),
 *   onError: (error) => console.error('SIWE login failed:', error),
 *   onGenerateMessage: (message) => console.log('Generated SIWE message:', message),
 * });
 * 
 * // Generate SIWE message for wallet to sign
 * const { message } = await generateSiweMessage({
 *   wallet: { address: '0x1234...' },
 *   from: {
 *     domain: 'example.com',
 *     uri: 'https://example.com'
 *   }
 * });
 * 
 * // Complete login with signature
 * await loginWithSiwe({ 
 *   signature: '0xabcd...',
 *   messageOverride: message // optional if different from cached
 * });
 * ```
 */
export function useLoginWithSiwe(opts?: UseLoginWithSiweOptions): UseLoginWithSiwe {
  const { client, siweState, setSiweState } = useOpenfortContext();
  const callbacksRef = useRef(opts);
  callbacksRef.current = opts;

  const generateSiweMessage = useCallback<GenerateSiweMessage>(
    async (args) => {
      try {
        setSiweState({ status: 'awaiting-message-signature' });

        const result = await client.auth.initSIWE({
          address: args.wallet,
        });

        setSiweState({
          status: 'awaiting-message-signature',
          message: result.message,
        });

        callbacksRef.current?.onGenerateMessage?.(result.message);

        return result;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to generate SIWE message');
        setSiweState({
          status: 'error',
          error: errorObj
        });
        callbacksRef.current?.onError?.(errorObj);
        throw errorObj;
      }
    },
    [client, setSiweState]
  );

  const loginWithSiwe = useCallback(
    async (opts: {
      signature: string;
      messageOverride?: string;
      disableSignup?: boolean;
    }): Promise<OpenfortUser> => {
      try {
        setSiweState({ status: 'submitting-message-signature' });

        const message = opts.messageOverride ||
          (siweState.status === 'awaiting-message-signature' ? siweState.message : '');

        if (!message) {
          throw new Error('SIWE message is required. Call generateSiweMessage first.');
        }

        const result = await client.auth.authenticateWithSIWE({
          signature: opts.signature,
          message,
          connectorType: 'siwe',
          walletClientType: 'openfort',
        });

        setSiweState({ status: 'done' });
        callbacksRef.current?.onSuccess?.(result.user);

        return result.user;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to login with SIWE');
        setSiweState({
          status: 'error',
          error: errorObj
        });
        callbacksRef.current?.onError?.(errorObj);
        throw errorObj;
      }
    },
    [client, siweState, setSiweState]
  );

  return {
    generateSiweMessage,
    loginWithSiwe,
    state: siweState,
  };
}