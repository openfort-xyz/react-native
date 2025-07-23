import React from 'react';
import type { Openfort as OpenfortClient, EmbeddedState } from '@openfort/openfort-js';
import { OAuthFlowState, PasswordFlowState, RecoveryFlowState, SiweFlowState } from '../types';
import type { Chain, EmbeddedWalletConfiguration } from './provider';

/**
 * Core Openfort context interface containing all SDK state and methods
 */
export interface OpenfortContextValue {
  /** The Openfort client instance */
  client: OpenfortClient;
  /** The current authenticated user, or null when unauthenticated */
  user: import('@openfort/openfort-js').AuthPlayerResponse | null;
  /** Whether the SDK has initialized and is ready for use */
  isReady: boolean;
  /** Any error encountered during SDK initialization */
  error: Error | null;
  /** Supported chains configuration */
  supportedChains?: [Chain, ...Chain[]];
  /** Embedded wallet configuration for Shield integration */
  embeddedWallet?: EmbeddedWalletConfiguration;
  /** Current embedded wallet state */
  embeddedState: EmbeddedState;

  // Flow states
  /** Password (email/SMS) authentication flow state */
  passwordState: PasswordFlowState;
  /** OAuth authentication flow state */
  oAuthState: OAuthFlowState;
  /** Sign-in with Ethereum flow state */
  siweState: SiweFlowState;
  /** Recovery flow state */
  recoveryFlowState: RecoveryFlowState;

  // State setters
  setPasswordState: React.Dispatch<React.SetStateAction<PasswordFlowState>>;
  setOAuthState: React.Dispatch<React.SetStateAction<OAuthFlowState>>;
  setSiweState: React.Dispatch<React.SetStateAction<SiweFlowState>>;
  setRecoveryFlowState: React.Dispatch<React.SetStateAction<RecoveryFlowState>>;

  // Core methods
  /** Logs the current user out and clears any stored tokens */
  logout: () => Promise<void>;
  /** Gets the current authenticated user's access token */
  getAccessToken: () => Promise<string | null>;

  // Internal methods (not exposed to consumers)
  /** @internal Refreshes user state after authentication changes */
  _internal: {
    refreshUserState: (user?: import('@openfort/openfort-js').AuthPlayerResponse) => Promise<import('@openfort/openfort-js').AuthPlayerResponse | null>;
  };
}

/**
 * React context for sharing Openfort SDK state throughout the component tree
 */
export const OpenfortContext = React.createContext<OpenfortContextValue | null>(null);

/**
 * Hook to access the Openfort context
 * Throws an error if used outside of a OpenfortProvider
 */
export function useOpenfortContext(): OpenfortContextValue {
  const context = React.useContext(OpenfortContext);

  if (!context) {
    throw new Error(
      'useOpenfortContext must be used within a OpenfortProvider. ' +
      'Make sure to wrap your app with <OpenfortProvider>.'
    );
  }

  return context;
}

/**
 * Hook to safely access the Openfort context
 * Returns null if used outside of a OpenfortProvider
 */
export function useOpenfortContextSafe(): OpenfortContextValue | null {
  return React.useContext(OpenfortContext);
}

/**
 * Type guard to check if a value is a valid OpenfortContextValue
 */
export function isOpenfortContextValue(value: unknown): value is OpenfortContextValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'client' in value &&
    'isReady' in value &&
    'logout' in value &&
    'getAccessToken' in value &&
    'embeddedState' in value &&
    '_internal' in value
  );
}