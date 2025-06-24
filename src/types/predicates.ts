import type {
  EmbeddedWalletState,
  EmbeddedWalletConnectedState,
  EmbeddedWalletConnectingState,
  EmbeddedWalletReconnectingState,
  EmbeddedWalletDisconnectedState,
  EmbeddedWalletNeedsRecoveryState,
  EmbeddedWalletNotCreatedState,
  EmbeddedWalletCreatingState,
  EmbeddedWalletErrorState,
  EmbeddedSolanaWalletState,
  EmbeddedSolanaWalletConnectedState,
  EmbeddedSolanaWalletConnectingState,
  EmbeddedSolanaWalletReconnectingState,
  EmbeddedSolanaWalletDisconnectedState,
  EmbeddedSolanaWalletNeedsRecoveryState,
  EmbeddedSolanaWalletNotCreatedState,
  EmbeddedSolanaWalletCreatingState,
  EmbeddedSolanaWalletErrorState,
} from './wallet';

/**
 * Type guard to check if embedded wallet is connected
 */
export function isConnected(s: EmbeddedWalletState): s is EmbeddedWalletConnectedState;
export function isConnected(s: EmbeddedSolanaWalletState): s is EmbeddedSolanaWalletConnectedState;
export function isConnected(s: EmbeddedWalletState | EmbeddedSolanaWalletState): boolean {
  return s.status === 'connected';
}

/**
 * Type guard to check if embedded wallet is reconnecting
 */
export function isReconnecting(s: EmbeddedWalletState): s is EmbeddedWalletReconnectingState;
export function isReconnecting(s: EmbeddedSolanaWalletState): s is EmbeddedSolanaWalletReconnectingState;
export function isReconnecting(s: EmbeddedWalletState | EmbeddedSolanaWalletState): boolean {
  return s.status === 'reconnecting';
}

/**
 * Type guard to check if embedded wallet is connecting
 */
export function isConnecting(s: EmbeddedWalletState): s is EmbeddedWalletConnectingState;
export function isConnecting(s: EmbeddedSolanaWalletState): s is EmbeddedSolanaWalletConnectingState;
export function isConnecting(s: EmbeddedWalletState | EmbeddedSolanaWalletState): boolean {
  return s.status === 'connecting';
}

/**
 * Type guard to check if embedded wallet is disconnected
 */
export function isDisconnected(s: EmbeddedWalletState): s is EmbeddedWalletDisconnectedState;
export function isDisconnected(s: EmbeddedSolanaWalletState): s is EmbeddedSolanaWalletDisconnectedState;
export function isDisconnected(s: EmbeddedWalletState | EmbeddedSolanaWalletState): boolean {
  return s.status === 'disconnected';
}

/**
 * Type guard to check if embedded wallet is not created
 */
export function isNotCreated(s: EmbeddedWalletState): s is EmbeddedWalletNotCreatedState;
export function isNotCreated(s: EmbeddedSolanaWalletState): s is EmbeddedSolanaWalletNotCreatedState;
export function isNotCreated(s: EmbeddedWalletState | EmbeddedSolanaWalletState): boolean {
  return s.status === 'not-created';
}

/**
 * Type guard to check if embedded wallet is being created
 */
export function isCreating(s: EmbeddedWalletState): s is EmbeddedWalletCreatingState;
export function isCreating(s: EmbeddedSolanaWalletState): s is EmbeddedSolanaWalletCreatingState;
export function isCreating(s: EmbeddedWalletState | EmbeddedSolanaWalletState): boolean {
  return s.status === 'creating';
}

/**
 * Type guard to check if embedded wallet has an error
 */
export function hasError(s: EmbeddedWalletState): s is EmbeddedWalletErrorState;
export function hasError(s: EmbeddedSolanaWalletState): s is EmbeddedSolanaWalletErrorState;
export function hasError(s: EmbeddedWalletState | EmbeddedSolanaWalletState): boolean {
  return s.status === 'error';
}

/**
 * Type guard to check if embedded wallet needs recovery
 */
export function needsRecovery(s: EmbeddedWalletState): s is EmbeddedWalletNeedsRecoveryState;
export function needsRecovery(s: EmbeddedSolanaWalletState): s is EmbeddedSolanaWalletNeedsRecoveryState;
export function needsRecovery(s: EmbeddedWalletState | EmbeddedSolanaWalletState): boolean {
  return s.status === 'needs-recovery';
}

/**
 * Additional utility predicates
 */

/**
 * Type guard to check if wallet is in a loading state (connecting, creating, reconnecting)
 */
export function isLoading(s: EmbeddedWalletState | EmbeddedSolanaWalletState): boolean {
  return s.status === 'connecting' || s.status === 'creating' || s.status === 'reconnecting';
}

/**
 * Type guard to check if wallet is ready for use
 */
export function isReady(s: EmbeddedWalletState | EmbeddedSolanaWalletState): boolean {
  return s.status === 'connected';
}

/**
 * Type guard to check if wallet needs user action
 */
export function needsUserAction(s: EmbeddedWalletState | EmbeddedSolanaWalletState): boolean {
  return s.status === 'not-created' || s.status === 'needs-recovery' || s.status === 'error';
}

/**
 * Type guard to check if wallet state is stable (not in transition)
 */
export function isStable(s: EmbeddedWalletState | EmbeddedSolanaWalletState): boolean {
  return !isLoading(s);
}

/**
 * Type guard to check if wallet can perform transactions
 */
export function canTransact(s: EmbeddedWalletState | EmbeddedSolanaWalletState): boolean {
  return s.status === 'connected';
}

/**
 * Gets a human-readable description of the wallet state
 */
export function getStateDescription(s: EmbeddedWalletState | EmbeddedSolanaWalletState): string {
  switch (s.status) {
    case 'connected':
      return 'Wallet is connected and ready to use';
    case 'connecting':
      return 'Connecting to wallet...';
    case 'reconnecting':
      return 'Reconnecting to wallet...';
    case 'creating':
      return 'Creating new wallet...';
    case 'disconnected':
      return 'Wallet is disconnected';
    case 'not-created':
      return 'No wallet found - create a new wallet to continue';
    case 'needs-recovery':
      return 'Wallet needs to be recovered';
    case 'error':
      return 'Wallet encountered an error';
    default:
      return 'Unknown wallet state';
  }
}

/**
 * Gets appropriate action text for the current state
 */
export function getActionText(s: EmbeddedWalletState | EmbeddedSolanaWalletState): string {
  switch (s.status) {
    case 'not-created':
      return 'Create Wallet';
    case 'needs-recovery':
      return 'Recover Wallet';
    case 'error':
      return 'Retry';
    case 'disconnected':
      return 'Connect Wallet';
    case 'connecting':
    case 'creating':
    case 'reconnecting':
      return 'Please wait...';
    case 'connected':
      return 'Wallet Ready';
    default:
      return 'Unknown';
  }
}