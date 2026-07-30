// Client creation and configuration

// Re-export important types and enums from openfort-js
export { RecoveryMethod } from '@openfort/openfort-js'
export { createOpenfortClient, type SDKOverrides } from './client'
export type { OpenfortContextValue } from './context'
// React context and hooks
export { isOpenfortContextValue, OpenfortContext, useOpenfortContext, useOpenfortContextSafe } from './context'
export type {
  CommonEmbeddedWalletConfiguration,
  EmbeddedWalletConfiguration,
  EncryptionSession,
  EncryptionSessionParams,
  OpenfortProviderProps,
} from './provider'
// Main provider component
export { OpenfortProvider } from './provider'

// Storage adapters
export { createNormalizedStorage, SecureStorageAdapter } from './storage'
