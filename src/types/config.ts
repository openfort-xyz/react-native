/**
 * Create guest account interface
 */
export interface UseGuestAuth {
  create: () => Promise<import('@openfort/openfort-js').AuthPlayerResponse>
}

/**
 * Embedded wallet state change hook options
 */
export interface UseOnEmbeddedWalletStateChange {
  onStateChange: (state: import('./wallet').EmbeddedWalletStatus) => void
}

/**
 * Set embedded wallet recovery parameters
 */
export type SetRecoveryParams =
  | {
      recoveryMethod: 'password'
      password: string
    }
  | {
      recoveryMethod: 'automatic'
    }

/**
 * Set embedded wallet recovery result
 */
export interface UseSetEmbeddedWalletRecoveryResult {
  /**
   * The embedded account with the updated recovery method.
   */
  account: import('@openfort/openfort-js').EmbeddedAccount
}

/**
 * Set embedded wallet recovery interface
 */
export interface UseSetEmbeddedWalletRecovery {
  /**
   * An async method to update the recovery method of the embedded wallet.
   */
  setRecovery: (params: SetRecoveryParams) => Promise<import('@openfort/openfort-js').EmbeddedAccount>
}
