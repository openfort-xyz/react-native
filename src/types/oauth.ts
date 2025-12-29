import type { OAuthProvider } from '@openfort/openfort-js'

/**
 * OAuth authentication flow state
 */
export type OAuthFlowState =
  | {
      status: 'initial' | 'loading' | 'awaiting-redirect' | 'done'
      error?: never
    }
  | {
      status: 'error'
      error: Error | null
    }

export const mapOAuthStatus = (status: OAuthFlowState) => {
  return {
    isLoading: status.status === 'loading',
    isError: status.status === 'error',
    isSuccess: status.status === 'done',
    error: status.error,
  }
}

/**
 * Login with OAuth input parameters
 */
export type LoginWithOAuthInput = LinkWithOAuthInput

/**
 * Link with OAuth input parameters
 */
export type LinkWithOAuthInput = {
  provider: OAuthProvider
  redirectUri?: string | undefined
  isLegacyAppleIosBehaviorEnabled?: boolean
}

/**
 * Login with OAuth hook interface
 */
export interface UseLoginWithOAuth {
  state: OAuthFlowState
  login: (input: LoginWithOAuthInput) => Promise<import('@openfort/openfort-js').AuthResponse | undefined>
}
