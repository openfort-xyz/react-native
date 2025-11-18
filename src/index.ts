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
// Re-export enums and values from @openfort/openfort-js
// Re-export event listener functionality from @openfort/openfort-js
export {
  AccountTypeEnum,
  AuthInitPayload,
  AuthPlayerResponse,
  AuthResponse,
  EmbeddedAccount,
  EmbeddedState,
  OAuthProvider,
  Openfort as OpenfortClient,
  OpenfortConfiguration,
  OpenfortError,
  OpenfortEventMap,
  OpenfortEvents,
  openfortEvents,
  Provider,
  RecoveryMethod,
  RecoveryParams,
  ShieldConfiguration,
  SignedMessagePayload,
} from '@openfort/openfort-js'
// Re-export all components and UI elements
export * from './components'
// Re-export constants
export * from './constants'
// Re-export core functionality
export * from './core'
// Re-export all hooks
export * from './hooks'

// Re-export native functionality
export * from './native'
// Re-export all types from the main types module
export * from './types'
