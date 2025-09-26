/**
 * Openfort React Native SDK hooks.
 *
 * This barrel re-exports all hook collections that ship with the SDK so consumers can
 * import from `@openfort/react-native/hooks`. The hooks are organised into the
 * following sub-modules:
 * - Core: Lifecycle/state helpers (e.g. `useOpenfort`)
 * - Auth: Authentication helpers (email, OAuth, SIWE, guest)
 * - Wallet: Embedded wallet management utilities
 */

// Re-export all core hooks
export * from './core';

// Re-export all authentication hooks
export * from './auth';

// Re-export all wallet hooks
export * from './wallet';
