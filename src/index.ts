/**
 * @packageDocumentation
 *
 * Entry point for the Openfort React Native SDK.
 *
 * This package re-exports the core SDK functionality, hooks, components and native helpers
 * required to integrate Openfort authentication and embedded wallets into React Native and
 * Expo applications.
 */

// Re-export commonly used types from @openfort/openfort-js
export {
    AuthPlayerResponse,
    OpenfortError,
    RecoveryMethod,
    RecoveryParams,
    Openfort as OpenfortClient,
    Provider,
    OpenfortConfiguration,
    ShieldConfiguration,
    EmbeddedState,
    AuthResponse,
    EmbeddedAccount,
    SignedMessagePayload,
    AuthInitPayload,
} from '@openfort/openfort-js';

// Re-export enums and values from @openfort/openfort-js
export {
    OAuthProvider,
    AccountTypeEnum,
} from '@openfort/openfort-js';

// Re-export event listener functionality from @openfort/openfort-js
export {
    openfortEvents,
    OpenfortEventMap,
    OpenfortEvents,
} from '@openfort/openfort-js';

// Re-export all types from the main types module
export * from './types';

// Re-export all hooks
export * from './hooks';

// Re-export all components and UI elements
export * from './components';

// Re-export core functionality
export * from './core';

// Re-export native functionality
export * from './native';

// Re-export constants
export * from './constants';