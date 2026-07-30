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
