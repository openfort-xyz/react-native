import type { ExternalWallet, OpenfortError } from '@openfort/openfort-js';
import type { AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js';
import type { OpenfortSuccessObject } from '@Openfort-io/public-api';

/**
 * Password (One-Time Password) authentication flow state
 */
export type PasswordFlowState = {
  status: 'initial';
} | {
  status: 'error';
  error: Error | null;
} | {
  status: 'sending-verification-code';
} | {
  status: 'awaiting-code-input';
} | {
  status: 'submitting-code';
} | {
  status: 'done';
};

/**
 * Sign-in with Ethereum (SIWE) flow state
 */
export type SiweFlowState = {
  status: 'initial';
} | {
  status: 'error';
  error: Error | null;
} | {
  status: 'generating-message';
} | {
  status: 'awaiting-signature';
} | {
  status: 'submitting-signature';
} | {
  status: 'done';
};


/**
 * Recovery flow state
 */
export type RecoveryFlowState = {
  status: 'initial' | 'creating-wallet' | 'upgrading-recovery' | 'recovering';
};

/**
 * Custom authentication flow state
 */
export type CustomAuthFlowState = {
  status: 'initial';
} | {
  status: 'loading';
} | {
  status: 'not-enabled';
} | {
  status: 'done';
} | {
  status: 'error';
  error: Error | null;
};

/**
 * Authentication success callback
 */
export type AuthSuccessCallback = (user: OpenfortUser, isNewUser?: boolean) => void;

/**
 * Authentication link success callback
 */
export type AuthLinkSuccessCallback = (user: OpenfortUser) => void;

/**
 * Error callback
 */
export type ErrorCallback = (error: OpenfortError | Error) => void;

/**
 * Password login hook options
 */
export type PasswordLoginHookOptions<AuthSourceArgs> = {
  onError?: ErrorCallback;
  onSendCodeSuccess?: (args: AuthSourceArgs) => void;
  onLoginSuccess?: AuthSuccessCallback;
};

/**
 * Password link hook options
 */
export type PasswordLinkHookOptions<AuthSourceArgs> = {
  onError?: ErrorCallback;
  onSendCodeSuccess?: (args: AuthSourceArgs) => void;
  onLinkSuccess?: AuthLinkSuccessCallback;
};

/**
 * Password login hook result
 */
export type PasswordLoginHookResult<SendArgs, LoginArgs> = {
  sendCode: (args: SendArgs) => Promise<OpenfortSuccessObject>;
  loginWithCode: (args: LoginArgs) => Promise<OpenfortUser | undefined>;
  state: PasswordFlowState;
};

/**
 * Password link hook result
 */
export type PasswordLinkHookResult<SendArgs, LinkArgs> = {
  sendCode: (args: SendArgs) => Promise<OpenfortSuccessObject>;
  linkWithCode: (args: LinkArgs) => Promise<OpenfortUser | undefined>;
  state: PasswordFlowState;
};

/**
 * SIWE message generation response
 */
export type GenerateSiweMessageResponse = Promise<string>;

/**
 * SIWE message generation function
 */
export type GenerateSiweMessage = (opts: {
  /** Wallet to request a Sign-In With Ethereum signature from */
  wallet: ExternalWallet;
  /**
   * Required fields that describe origin of Sign-In With Ethereum signature request
   */
  from: {
    /** RFC 3986 authority that is requesting the signing */
    domain: string;
    /** RFC 3986 URI referring to the resource that is the subject of the signing */
    uri: string;
  };
}) => GenerateSiweMessageResponse;
