// Client creation and configuration

export type { SDKOverrides } from '@openfort/openfort-js'

// Re-export important types and enums from openfort-js
export { RecoveryMethod } from '@openfort/openfort-js'
export { createOpenfortClient, getDefaultClient, setDefaultClient } from './client'
export type { OpenfortContextValue } from './context'
// React context and hooks
export { isOpenfortContextValue, OpenfortContext, useOpenfortContext, useOpenfortContextSafe } from './context'
export type {
  CommonEmbeddedWalletConfiguration,
  EmbeddedWalletConfiguration,
  EncryptionSession,
  OpenfortProviderProps,
} from './provider'
// Main provider component
export { OpenfortProvider } from './provider'

// Storage adapters
export { createNormalizedStorage, SecureStorageAdapter } from './storage'
