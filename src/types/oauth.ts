import type { OAuthProviderType } from '@Openfort-io/js-sdk-core';
import type { OpenfortUser, OpenfortAuthenticatedUser } from '@Openfort-io/public-api';
import type { AuthSuccessCallback, ErrorCallback } from './auth';

/**
 * OAuth authentication flow state
 */
export type OAuthFlowState = {
    status: 'initial';
} | {
    status: 'loading';
} | {
    status: 'done';
} | {
    status: 'error';
    error: Error | null;
};

/**
 * OAuth hook options
 */
export type OAuthHookOptions = {
    /** @deprecated Use a `catch` on the promise returned by `login` or `link` instead of using this callback. */
    onError?: ErrorCallback;
    /** @deprecated Use a `then` on the promise returned by `login` or `link` instead of using this callback. */
    onSuccess?: AuthSuccessCallback;
};

/**
 * OAuth tokens interface
 */
export interface OAuthTokens extends NonNullable<OpenfortAuthenticatedUser['oauth_tokens']> { }

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
    provider: OAuthProviderType;
    redirectUri?: string | undefined;
    /**
     * Enables legacy Apple OAuth on iOS.
     * By default, Apple login on iOS will use the native Sign in with Apple functionality.
     * Enabling this flag will override this behavior to use the web-based OAuth flow, popping
     * up a webview for authentication.
     */
    isLegacyAppleIosBehaviorEnabled?: boolean;
};

/**
 * Login with OAuth hook interface
 */
export interface UseLoginWithOAuth {
    state: OAuthFlowState;
    login: (input: LoginWithOAuthInput) => Promise<OpenfortUser | undefined>;
}

/**
 * Link with OAuth hook interface
 */
export interface UseLinkWithOAuth {
    state: OAuthFlowState;
    link: (input: LinkWithOAuthInput) => Promise<OpenfortUser | undefined>;
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
    provider: OAuthProviderType;
    subject: string;
}
