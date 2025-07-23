/**
 * Hook for Sign-In with Ethereum (SIWE) login functionality
 */
import { useCallback, useRef } from 'react';
import type { AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';
import type {
  SiweLoginHookOptions,
  SiweLoginHookResult,
  GenerateSiweMessage,
} from '../../types';


/**
 * Hook for Sign-In with Ethereum (SIWE) authentication
 * 
 * This hook provides a two-step SIWE authentication flow:
 * 1. Generate a SIWE message for the user's wallet to sign
 * 2. Authenticate the user with the signed message
 * 
 * @param opts - Configuration options including success/error callbacks
 * @returns Object with generateSiweMessage, loginWithSiwe functions and current SIWE flow state
 * 
 * @example
 * ```tsx
 * const { generateSiweMessage, loginWithSiwe, state } = useLoginWithSiwe({
 *   onSuccess: (user) => console.log('SIWE login successful:', user),
 *   onError: (error) => console.error('SIWE login failed:', error),
 *   onGenerateMessage: (message) => console.log('Generated SIWE message:', message),
 * });
 * 
 * // Step 1: Generate SIWE message for wallet to sign
 * const message = await generateSiweMessage({
 *   wallet: { address: '0x1234...' },
 *   from: {
 *     domain: 'example.com',
 *     uri: 'https://example.com'
 *   }
 * });
 * 
 * // Step 2: Complete login with wallet signature
 * const user = await loginWithSiwe({ 
 *   signature: '0xabcd...',
 *   walletAddress: '0x1234...',
 *   messageOverride: message // optional, uses cached message if not provided
 * });
 * ```
 */
export function useLoginWithSiwe(opts?: SiweLoginHookOptions): SiweLoginHookResult {
  const { client, siweState, setSiweState, _internal } = useOpenfortContext();
  const callbacksRef = useRef(opts);
  callbacksRef.current = opts;

  const generateSiweMessage = useCallback<GenerateSiweMessage>(
    async (args) => {
      try {
        setSiweState({ status: 'generating-message' });

        // Get wallet address from the external wallet
        const walletAddress = typeof args.wallet === 'string' ? args.wallet : args.wallet.address;

        const result = await client.auth.initSIWE({
          address: walletAddress,
        });

        // Build the SIWE message
        const siweMessage = `${args.from.domain} wants you to sign in with your Ethereum account:\n${walletAddress}\n\nSign in to ${args.from.domain}\n\nURI: ${args.from.uri}\nVersion: 1\nChain ID: 1\nNonce: ${result.nonce}\nIssued At: ${new Date().toISOString()}`;

        setSiweState({
          status: 'awaiting-signature',
        });

        callbacksRef.current?.onGenerateMessage?.(siweMessage);

        return siweMessage;
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
      walletAddress: string;
      messageOverride?: string;
      disableSignup?: boolean;
    }): Promise<OpenfortUser> => {
      try {
        setSiweState({ status: 'submitting-signature' });

        const message = opts.messageOverride || '';

        if (!message) {
          throw new Error('SIWE message is required. Call generateSiweMessage first.');
        }

        const result = await client.auth.authenticateWithSIWE({
          signature: opts.signature,
          message: message,
          walletClientType: 'unknown',
          connectorType: 'unknown'
        });

        setSiweState({ status: 'done' });
        const user = result.player;
        // Refresh user state in provider
        await _internal.refreshUserState(user);
        callbacksRef.current?.onSuccess?.(user, false);

        return user;
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
    [client, siweState, setSiweState, _internal]
  );

  return {
    generateSiweMessage,
    loginWithSiwe,
    state: siweState,
  };
}