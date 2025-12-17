import type { OpenfortError, AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js'

/**
 * Password authentication flow state
 */
export type PasswordFlowState =
  | {
      status: 'initial'
    }
  | {
      status: 'error'
      error: Error | null
    }
  | {
      status: 'sending-verification-code'
    }
  | {
      status: 'awaiting-code-input'
    }
  | {
      status: 'submitting-code'
    }
  | {
      status: 'done'
    }

/**
 * Sign-in with Ethereum (SIWE) flow state
 */
export type SiweFlowState =
  | {
      status: 'initial'
    }
  | {
      status: 'error'
      error: Error | null
    }
  | {
      status: 'generating-message'
    }
  | {
      status: 'awaiting-signature'
    }
  | {
      status: 'submitting-signature'
    }
  | {
      status: 'done'
    }

/**
 * Recovery flow state
 */
export type RecoveryFlowState = {
  status: 'initial' | 'creating-wallet' | 'upgrading-recovery' | 'recovering'
}

/**
 * Authentication success callback
 */
export type AuthSuccessCallback = (user: OpenfortUser, isNewUser?: boolean) => void

/**
 * Error callback
 */
export type ErrorCallback = (error: OpenfortError | Error) => void

/**
 * Email login hook options
 */
export interface EmailLoginHookOptions {
  onError?: ErrorCallback
  onSuccess?: AuthSuccessCallback
}

/**
 * Email login hook result
 */
export interface EmailLoginHookResult {
  login: (credentials: { email: string; password: string }) => Promise<OpenfortUser | undefined>
  signup: (credentials: { email: string; password: string; name?: string }) => Promise<OpenfortUser | undefined>
  state: PasswordFlowState
}

/**
 * SIWE message generation response
 */
export type GenerateSiweMessageResponse = Promise<string>

/**
 * SIWE message generation function
 */
export type GenerateSiweMessage = (opts: {
  /** Wallet to request a Sign-In With Ethereum signature from */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wallet: any // External wallet interface
  /**
   * Required fields that describe origin of Sign-In With Ethereum signature request
   */
  from: {
    /** RFC 3986 authority that is requesting the signing */
    domain: string
    /** RFC 3986 URI referring to the resource that is the subject of the signing */
    uri: string
  }
}) => GenerateSiweMessageResponse

/**
 * SIWE login hook options
 */
export interface SiweLoginHookOptions {
  onError?: ErrorCallback
  onSuccess?: AuthSuccessCallback
  onGenerateMessage?: (message: string) => void
}

/**
 * SIWE login hook result
 */
export interface SiweLoginHookResult {
  generateSiweMessage: GenerateSiweMessage
  state: SiweFlowState
  loginWithSiwe: (opts: {
    signature: string
    walletAddress: string
    messageOverride?: string
    disableSignup?: boolean
  }) => Promise<OpenfortUser>
}
