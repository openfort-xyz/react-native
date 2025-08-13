import type { OAuthProvider } from '@openfort/openfort-js';
import type { AuthSuccessCallback, ErrorCallback } from './auth';

/**
 * OAuth authentication flow state
 */
export type OAuthFlowState = {
    status: 'initial' | 'loading' | 'awaiting-redirect' | 'done' ;
    error?: never;
} | {
    status: 'error';
    error: Error | null;
};

export const mapStatus = (status: OAuthFlowState) => {
  return {
    isLoading: status.status === 'loading',
    isError: status.status === 'error',
    isSuccess: status.status === 'done',
    error: status.error
  }
}


/**
 * OAuth tokens interface
 */
export interface OAuthTokens {
    [key: string]: any;
}

/**
 * OAuth tokens hook options
 */
export interface UseOAuthTokensOptions {
    /**
     * Callback function triggered when OAuth tokens are granted to the user after any OAuth Authorization flow.
     * @param tokens - The set of OAuth tokens granted to the user.
     */
    onOAuthTokenGrant: (tokens: OAuthTokens) => void;
}

/**
 * Login with OAuth input parameters
 */
export type LoginWithOAuthInput = LinkWithOAuthInput

/**
 * Link with OAuth input parameters
 */
export type LinkWithOAuthInput = {
    provider: OAuthProvider;
    redirectUri?: string | undefined;
    isLegacyAppleIosBehaviorEnabled?: boolean;
};

/**
 * Login with OAuth hook interface
 */
export interface UseLoginWithOAuth {
    state: OAuthFlowState;
    login: (input: LoginWithOAuthInput) => Promise<import('@openfort/openfort-js').AuthPlayerResponse | undefined>;
}

/**
 * Link with OAuth hook interface
 */
export interface UseLinkWithOAuth {
    state: OAuthFlowState;
    link: (input: LinkWithOAuthInput) => Promise<import('@openfort/openfort-js').AuthPlayerResponse | undefined>;
}

/**
 * Unlink OAuth hook options
 */
export interface UnlinkOAuthOptions {
    onError?: ErrorCallback;
    onSuccess?: AuthSuccessCallback;
}

/**
 * Unlink OAuth parameters
 */
export interface UnlinkOAuthParams {
    provider: OAuthProvider;
    subject: string;
}
