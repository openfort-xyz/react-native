import type { EmbeddedWalletConfig, Storage, Chain } from '@Openfort-io/js-sdk-core';

/**
 * Custom authentication provider configuration
 */
export type CustomAuthProviderConfig = {
    /**
     * If true, enable custom authentication integration.
     * This enables a JWT from a custom auth provider to be used to authenticate Openfort embedded wallets.
     * Defaults to true.
     */
    enabled?: boolean;
    /**
     * A callback that returns the user's custom auth provider's access token as a string.
     * Can be left blank if using cookies to store and send access tokens
     */
    getCustomAccessToken: () => Promise<string | undefined>;
    /**
     * Custom auth providers loading state
     */
    isLoading: boolean;
};

/**
 * Openfort configuration options
 */
export type OpenfortConfig = {
    customAuth?: CustomAuthProviderConfig;
    embedded?: {
        ethereum?: EmbeddedWalletConfig;
        solana?: EmbeddedWalletConfig;
    };
};

/**
 * Session signer interface
 */
export interface SessionSigner {
    signerId: string;
    policyIds: string[];
}

/**
 * Add session signers input
 */
export interface AddSessionSignersInput {
    address: string;
    signers: SessionSigner[];
}

/**
 * Add session signers output
 */
export interface AddSessionSignersOutput {
    user: import('@Openfort-io/public-api').OpenfortUser;
}

/**
 * Remove session signers input
 */
export interface RemoveSessionSignersInput {
    address: string;
}

/**
 * Remove session signers output
 */
export interface RemoveSessionSignersOutput {
    user: import('@Openfort-io/public-api').OpenfortUser;
}

/**
 * Session signers hook interface
 */
export interface UseSessionSignersInterface {
    /**
     * Grants access of the wallet to a specified key quorum.
     */
    addSessionSigners: (input: AddSessionSignersInput) => Promise<AddSessionSignersOutput>;
    /**
     * Removes all session signers from a user wallet.
     */
    removeSessionSigners: (input: RemoveSessionSignersInput) => Promise<RemoveSessionSignersOutput>;
}

/**
 * Send email code input
 */
export interface SendEmailCodeInput {
    /** The new email address you wish to update the user to. */
    newEmailAddress: string;
}

/**
 * Update email input
 */
export interface UpdateEmailInput {
    /** The new email address you wish to update the user to. */
    newEmailAddress: string;
    /** The one time code received by the user on the new email address. */
    code: string;
}

/**
 * Update email hook interface
 */
export interface UseUpdateEmailInterface {
    /**
     * Prepare an email address update by sending a one time code to a new email address.
     */
    sendCode: (input: SendEmailCodeInput) => Promise<void>;
    /**
     * Update a user profile with a new email address by submitting a one time code.
     */
    updateEmail: (input: UpdateEmailInput) => Promise<import('@Openfort-io/public-api').OpenfortUser>;
}

/**
 * Send phone code input
 */
export interface SendPhoneCodeInput {
    /** The new phone number you wish to update the user to. */
    newPhoneNumber: string;
}

/**
 * Update phone input
 */
export interface UpdatePhoneInput {
    /** The new phone number you wish to update the user to. */
    newPhoneNumber: string;
    /** The one time code received by the user on the new phone number. */
    code: string;
}

/**
 * Update phone hook interface
 */
export interface UseUpdatePhoneInterface {
    /**
     * Prepare a phone number update by sending a one time code to a new phone number.
     */
    sendCode: (input: SendPhoneCodeInput) => Promise<void>;
    /**
     * Update a user profile with a new phone number by submitting a one time code.
     */
    updatePhone: (input: UpdatePhoneInput) => Promise<import('@Openfort-io/public-api').OpenfortUser>;
}

/**
 * Create guest account options
 */
export interface UseCreateGuestAccountOptions {
    onSuccess: import('./auth').AuthSuccessCallback;
    onError?: import('./auth').ErrorCallback;
}

/**
 * Create guest account interface
 */
export interface UseCreateGuestAccount {
    create: () => Promise<import('@Openfort-io/public-api').OpenfortUser>;
}

/**
 * Embedded wallet state change hook options
 */
export interface UseOnEmbeddedWalletStateChange {
    onStateChange: (state: import('./wallet').EmbeddedWalletState) => void;
}

/**
 * Set embedded wallet recovery parameters
 */
export type SetRecoveryParams = {
    recoveryMethod: 'password';
    password: string;
} | {
    recoveryMethod: 'automatic';
};

/**
 * Set embedded wallet recovery result
 */
export interface UseSetEmbeddedWalletRecoveryResult {
    /**
     * The user object with the updated recovery method.
     * Return null if the flow was deferred, such as for Google Drive.
     */
    user: import('@Openfort-io/public-api').OpenfortUser | null;
}

/**
 * Set embedded wallet recovery interface
 */
export interface UseSetEmbeddedWalletRecovery {
    /**
     * An async method to update the recovery method of the embedded wallet.
     */
    setRecovery: (params: SetRecoveryParams) => Promise<UseSetEmbeddedWalletRecoveryResult>;
}

/**
 * Recovery parameters
 */
export type RecoverParams = {
    recoveryMethod: 'password';
    password: string;
} | {
    recoveryMethod: 'automatic';
}

/**
 * Recover embedded wallet interface
 */
export interface UseRecoverEmbeddedWallet {
    /**
     * An async method to recover the embedded wallet.
     */
    recover: (params: RecoverParams) => Promise<void>;
}