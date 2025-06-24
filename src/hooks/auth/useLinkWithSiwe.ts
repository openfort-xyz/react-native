/**
 * Hook for linking Ethereum accounts using SIWE to existing users
 */
import { useCallback, useRef } from 'react';
import type { AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';
import type {
  SiweFlowState,
  ErrorCallback,
  AuthLinkSuccessCallback,
  GenerateSiweMessage,
} from '../../types';

/**
 * Options for SIWE linking hook
 */
export interface UseLinkWithSiweOptions {
  onError?: ErrorCallback;
  onSuccess?: AuthLinkSuccessCallback;
  onGenerateMessage?: (message: string) => void;
}

/**
 * Result interface for SIWE linking hook
 */
export interface UseLinkWithSiwe {
  generateSiweMessage: GenerateSiweMessage;
  state: SiweFlowState;
  linkWithSiwe: (opts: {
    /** Signature generated against standard Sign-In With Ethereum message */
    signature: string;
    /**
     * Optional SIWE message, only needed if the message differs from the one in memory 
     * that was cached in previous call to `generateMessage`
     */
    messageOverride?: string;
  }) => Promise<OpenfortUser>;
}

/**
 * Hook for linking Ethereum wallets to existing authenticated users using SIWE
 * 
 * @param opts - Configuration options including success/error callbacks
 * @returns Object with generateSiweMessage, linkWithSiwe functions plus current state
 * 
 * @example
 * ```tsx
 * const { generateSiweMessage, linkWithSiwe, state } = useLinkWithSiwe({
 *   onSuccess: (user) => console.log('Ethereum wallet linked:', user),
 *   onError: (error) => console.error('Wallet linking failed:', error),
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
 * // Complete linking with signature
 * await linkWithSiwe({ 
 *   signature: '0xabcd...',
 *   messageOverride: message // optional if different from cached
 * });
 * ```
 */
export function useLinkWithSiwe(opts?: UseLinkWithSiweOptions): UseLinkWithSiwe {
  const { client, siweState, setSiweState } = useOpenfortContext();
  const callbacksRef = useRef(opts);
  callbacksRef.current = opts;

  const generateSiweMessage = useCallback<GenerateSiweMessage>(
    async (args) => {
      try {
        setSiweState({ status: 'awaiting-message-signature' });

        const result = await client.auth.initSIWE({
          address: args.wallet,
          from: args.from,
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

  const linkWithSiwe = useCallback(
    async (opts: {
      signature: string;
      messageOverride?: string;
    }): Promise<OpenfortUser> => {
      try {
        setSiweState({ status: 'submitting-message-signature' });

        const message = opts.messageOverride ||
          (siweState.status === 'awaiting-message-signature' ? siweState.message : '');

        if (!message) {
          throw new Error('SIWE message is required. Call generateSiweMessage first.');
        }

        const result = await client.auth.linkWallet({
          signature: opts.signature,
          message,
        });

        setSiweState({ status: 'done' });
        callbacksRef.current?.onSuccess?.(result.player);

        return result.player;
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
    [client, siweState, setSiweState]
  );

  return {
    generateSiweMessage,
    linkWithSiwe,
    state: siweState,
  };
}