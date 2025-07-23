/**
 * Hook for linking Ethereum accounts using SIWE to existing users
 */
import { useCallback, useRef } from 'react';
import type { AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';
import type {
  SiweLinkHookOptions,
  SiweLinkHookResult,
  SiweFlowState,
  ErrorCallback,
  AuthLinkSuccessCallback,
  GenerateSiweMessage,
} from '../../types';


/**
 * Hook for linking Ethereum wallets to existing authenticated users using SIWE
 * 
 * This hook allows users who are already authenticated to link an additional Ethereum wallet
 * using Sign-In with Ethereum (SIWE). The user must be logged in to use this hook.
 * 
 * @param opts - Configuration options including success/error callbacks
 * @returns Object with generateSiweMessage, linkWithSiwe functions and current SIWE flow state
 * 
 * @example
 * ```tsx
 * const { generateSiweMessage, linkWithSiwe, state } = useLinkWithSiwe({
 *   onSuccess: (user) => console.log('Ethereum wallet linked:', user),
 *   onError: (error) => console.error('Wallet linking failed:', error),
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
 * // Step 2: Complete wallet linking with signature
 * const result = await linkWithSiwe({ 
 *   signature: '0xabcd...',
 *   walletAddress: '0x1234...',
 *   messageOverride: message // optional, uses cached message if not provided
 * });
 * ```
 */
export function useLinkWithSiwe(opts?: SiweLinkHookOptions): SiweLinkHookResult {
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

  const linkWithSiwe = useCallback(
    async (opts: {
      signature: string;
      messageOverride?: string;
      walletAddress: string;
    }): Promise<OpenfortUser> => {
      try {
        setSiweState({ status: 'submitting-signature' });

        const message = opts.messageOverride || '';

        if (!message) {
          throw new Error('SIWE message is required. Call generateSiweMessage first.');
        }

        // Get current user access token for linking
        const accessToken = await client.getAccessToken();
        if (!accessToken) {
          throw new Error('User must be authenticated to link wallet');
        }

        const result = await client.auth.authenticateWithSIWE({
          signature: opts.signature,
          message: message,
          walletClientType: 'unknown',
          connectorType: 'unknown',
        });

        setSiweState({ status: 'done' });
        const user = result.player;
        // Refresh user state to reflect SIWE linking
        await _internal.refreshUserState();
        callbacksRef.current?.onSuccess?.(user);

        return user;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to link with SIWE');
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
    linkWithSiwe,
    state: siweState,
  };
}