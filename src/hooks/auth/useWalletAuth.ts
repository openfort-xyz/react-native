import type { AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js'
import { useCallback } from 'react'
import type { SiweFlowState } from '../..'
import { useOpenfortContext } from '../../core/context'
import { onError, onSuccess } from '../../lib/hookConsistency'
import type { OpenfortHookOptions } from '../../types/hookOption'
import { OpenfortError, OpenfortErrorType } from '../../types/openfortError'

export type WalletHookResult = {
  error?: OpenfortError
  user?: OpenfortUser
  // wallet?: UserWallet;
}

export type WalletHookOptions = OpenfortHookOptions<WalletHookResult | GenerateSiweMessageResult>

type SiweOptions = {
  signature: string
  walletAddress: string
  messageOverride?: string
  disableSignup?: boolean
} & OpenfortHookOptions<WalletHookResult>

type LinkSiweOptions = {
  signature: string
  walletAddress: string
  messageOverride?: string
} & OpenfortHookOptions<WalletHookResult>

type GenerateSiweMessageOptions = {
  wallet: string | { address: string }
  from: {
    domain: string
    uri: string
  }
} & OpenfortHookOptions<GenerateSiweMessageResult>

type GenerateSiweMessageResult = {
  error?: OpenfortError
  message?: string
}

const mapStatus = (status: SiweFlowState) => {
  return {
    isLoading:
      status.status === 'generating-message' ||
      status.status === 'awaiting-signature' ||
      status.status === 'submitting-signature',
    isError: status.status === 'error',
    isSuccess: status.status === 'done',
    error: 'error' in status ? status.error : null,
    isAwaitingSignature: status.status === 'awaiting-signature',
    isGeneratingMessage: status.status === 'generating-message',
    isSubmittingSignature: status.status === 'submitting-signature',
  }
}

/**
 * Hook for handling Sign-In With Ethereum (SIWE) flows.
 *
 * This hook orchestrates SIWE message generation, signature submission, and state
 * tracking so that external wallets can either authenticate a user (`signInWithSiwe`)
 * or be linked to an existing account (`linkSiwe`).
 *
 * @param hookOptions - Optional callbacks for handling success or error events from the SIWE flows.
 * @returns SIWE helpers for generating messages, signing in, linking wallets, and inspecting flow status.
 *
 * @example
 * ```tsx
 * const { generateSiweMessage, signInWithSiwe, linkSiwe, isAwaitingSignature } = useWalletAuth({
 *   onSuccess: ({ user }) => console.log('SIWE flow completed for', user?.id),
 * });
 *
 * const { message } = await generateSiweMessage({
 *   wallet: connectedWallet.address,
 *   from: { domain: 'app.openfort.io', uri: 'https://app.openfort.io' },
 * });
 *
 * const signature = await connectedWallet.signMessage(message);
 * await signInWithSiwe({ walletAddress: connectedWallet.address, signature, messageOverride: message });
 * ```
 */
export function useWalletAuth(hookOptions?: WalletHookOptions) {
  const { client, siweState, setSiweState, _internal } = useOpenfortContext()

  const generateSiweMessage = useCallback(
    async (args: GenerateSiweMessageOptions): Promise<GenerateSiweMessageResult> => {
      try {
        setSiweState({ status: 'generating-message' })

        // Get wallet address from the external wallet
        const walletAddress = typeof args.wallet === 'string' ? args.wallet : args.wallet.address

        const result = await client.auth.initSIWE({
          address: walletAddress,
        })

        // Build the SIWE message
        const siweMessage = `${args.from.domain} wants you to sign in with your Ethereum account:\n${walletAddress}\n\nSign in to ${args.from.domain}\n\nURI: ${args.from.uri}\nVersion: 1\nChain ID: 1\nNonce: ${result.nonce}\nIssued At: ${new Date().toISOString()}`

        setSiweState({
          status: 'awaiting-signature',
        })

        return onSuccess({
          hookOptions,
          options: args,
          data: { message: siweMessage },
        })
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to generate SIWE message')
        setSiweState({
          status: 'error',
          error: errorObj,
        })
        return onError({
          hookOptions,
          options: args,
          error: new OpenfortError('Failed to generate SIWE message', OpenfortErrorType.AUTHENTICATION_ERROR, {
            error: errorObj,
          }),
        })
      }
    },
    [client, setSiweState]
  )

  const linkSiwe = useCallback(
    async (opts: LinkSiweOptions): Promise<WalletHookResult> => {
      try {
        setSiweState({ status: 'submitting-signature' })

        const message = opts.messageOverride || ''

        if (!message) {
          throw new Error('SIWE message is required. Call generateSiweMessage first.')
        }

        // Get current user access token for linking
        const accessToken = await client.getAccessToken()
        if (!accessToken) {
          throw new Error('User must be authenticated to link wallet')
        }

        const result = await client.auth.authenticateWithSIWE({
          signature: opts.signature,
          message: message,
          walletClientType: 'unknown',
          connectorType: 'unknown',
        })

        setSiweState({ status: 'done' })
        const user = result.player
        // Refresh user state to reflect SIWE linking
        await _internal.refreshUserState()

        return onSuccess({
          hookOptions,
          options: opts,
          data: { user },
        })
      } catch (e) {
        const error = new OpenfortError('Failed to link in with Ethereum', OpenfortErrorType.AUTHENTICATION_ERROR, {
          error: e,
        })
        setSiweState({
          status: 'error',
          error,
        })

        return onError({
          hookOptions,
          options: opts,
          error,
        })
      }
    },
    [client, siweState, setSiweState, _internal]
  )

  const signInWithSiwe = useCallback(
    async (opts: SiweOptions): Promise<WalletHookResult> => {
      try {
        setSiweState({ status: 'submitting-signature' })

        const message = opts.messageOverride || ''

        if (!message) {
          throw new Error('SIWE message is required. Call generateSiweMessage first.')
        }

        const result = await client.auth.authenticateWithSIWE({
          signature: opts.signature,
          message: message,
          walletClientType: 'unknown',
          connectorType: 'unknown',
        })

        setSiweState({ status: 'done' })
        const user = result.player
        // Refresh user state in provider
        await _internal.refreshUserState(user)
        return onSuccess({
          hookOptions,
          options: opts,
          data: { user },
        })
      } catch (e) {
        const error = new OpenfortError('Failed to sign in with Ethereum', OpenfortErrorType.AUTHENTICATION_ERROR, {
          error: e,
        })
        setSiweState({
          status: 'error',
          error,
        })

        return onError({
          hookOptions,
          options: opts,
          error,
        })
      }
    },
    [client, siweState, setSiweState, _internal]
  )
  return {
    generateSiweMessage,
    signInWithSiwe,
    linkSiwe,
    ...mapStatus(siweState),
  }
}
