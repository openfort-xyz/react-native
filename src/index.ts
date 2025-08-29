/**
 * Openfort React Native SDK
 * 
 * A comprehensive React Native SDK for integrating with the Openfort platform.
 * This SDK provides authentication, embedded wallets, session management, and UI components
 * for building decentralized applications on React Native.
 * 
 * @author Openfort
 * @version 0.1.0
 */

// Re-export commonly used types from @openfort/openfort-js
export {
    AuthPlayerResponse,
    OpenfortError,
    RecoveryMethod,
    Openfort as OpenfortClient,
    Provider,
    OpenfortConfiguration,
    ShieldConfiguration,
    EmbeddedState,
} from '@openfort/openfort-js';

// Re-export enums and values from @openfort/openfort-js
export {
    OAuthProvider,
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