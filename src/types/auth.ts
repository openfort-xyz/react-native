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
