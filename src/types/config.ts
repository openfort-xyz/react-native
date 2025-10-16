/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Storage interface
 */
export interface Storage {
  [key: string]: any
}

/**
 * Chain configuration
 */
export interface Chain {
  [key: string]: any
}

/**
 * Custom authentication provider configuration
 */
export type CustomAuthProviderConfig = {
  /**
   * If true, enable custom authentication integration.
   * This enables a JWT from a custom auth provider to be used to authenticate Openfort embedded wallets.
   * Defaults to true.
   */
  enabled?: boolean
  /**
   * A callback that returns the user's custom auth provider's access token as a string.
   * Can be left blank if using cookies to store and send access tokens
   */
  getCustomAccessToken: () => Promise<string | undefined>
  /**
   * Custom auth providers loading state
   */
  isLoading: boolean
}

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
