import type {
    OpenfortEmbeddedWalletProvider,
    OpenfortEmbeddedSolanaWalletProvider,
} from '@Openfort-io/js-sdk-core';
import type {
    OpenfortEthereumEmbeddedWalletAccount,
    OpenfortSolanaEmbeddedWalletAccount,
    OpenfortBitcoinSegwitEmbeddedWalletAccount,
    OpenfortBitcoinTaprootEmbeddedWalletAccount
} from '@Openfort-io/public-api';
import type { ErrorCallback } from './auth';

/**
 * Openfort embedded wallet account union type
 */
export type OpenfortEmbeddedWalletAccount =
    | OpenfortEthereumEmbeddedWalletAccount
    | OpenfortSolanaEmbeddedWalletAccount
    | OpenfortBitcoinSegwitEmbeddedWalletAccount
    | OpenfortBitcoinTaprootEmbeddedWalletAccount;

/**
 * @deprecated use the OpenfortEmbeddedWalletAccount type instead
 */
export type EmbeddedWallet = OpenfortEmbeddedWalletAccount;

/**
 * Wallet recovery callbacks
 */
export type WalletRecoveryCallbacks = {
    onError?: ErrorCallback;
    onSuccess?: (provider: OpenfortEmbeddedWalletProvider) => void;
};

/**
 * Solana wallet recovery callbacks
 */
export type SolanaWalletRecoveryCallbacks = {
    onError?: ErrorCallback;
    onSuccess?: (provider: OpenfortEmbeddedSolanaWalletProvider) => void;
};

/**
 * Recovery method options
 */
export type RecoveryMethodOptions =
    | string
    | undefined
    | { recoveryMethod: 'automatic' }
    | { recoveryMethod: 'password'; password: string }

/**
 * @deprecated Use one of: CreateEthereumEmbeddedWalletOpts, RecoverEthereumEmbeddedWalletOpts, CreateSolanaEmbeddedWalletOpts, RecoverSolanaEmbeddedWalletOpts
 */
export type CreateOrRecoverEmbeddedWalletProps = RecoveryMethodOptions;

/**
 * Ethereum wallet creation options
 */
export type CreateEthereumEmbeddedWalletOpts = RecoveryMethodOptions;

/**
 * Ethereum wallet recovery options
 */
export type RecoverEthereumEmbeddedWalletOpts = RecoveryMethodOptions;

/**
 * Solana wallet creation options
 */
export type CreateSolanaEmbeddedWalletOpts = (undefined | { recoveryMethod: 'automatic' }) & {
    createAdditional?: boolean;
};

/**
 * Solana wallet recovery options
 */
export type RecoverSolanaEmbeddedWalletOpts =
    | undefined
    | { recoveryMethod: 'automatic' }
    | { recoveryMethod: 'password'; password: string }

/**
 * Set recovery properties
 */
export type SetRecoveryProps =
    | {}
    | { recoveryMethod: 'password'; password: string }

// Embedded Wallet State Interfaces

/**
 * Connected embedded wallet state
 */
interface IEmbeddedWalletConnectedState {
    status: 'connected';
    provider: OpenfortEmbeddedWalletProvider;
    account: OpenfortEthereumEmbeddedWalletAccount;
}

/**
 * Connecting embedded wallet state
 */
interface IEmbeddedWalletConnectingState {
    status: 'connecting';
    account: OpenfortEthereumEmbeddedWalletAccount;
}

/**
 * Reconnecting embedded wallet state
 */
interface IEmbeddedWalletReconnectingState {
    status: 'reconnecting';
    account: OpenfortEthereumEmbeddedWalletAccount;
}

/**
 * Disconnected embedded wallet state
 */
interface IEmbeddedWalletDisconnectedState {
    status: 'disconnected';
    account: null;
}

/**
 * Needs recovery embedded wallet state
 */
interface IEmbeddedWalletNeedsRecoveryState {
    status: 'needs-recovery';
    account: OpenfortEthereumEmbeddedWalletAccount;
}

/**
 * Not created embedded wallet state
 */
interface IEmbeddedWalletNotCreatedState {
    status: 'not-created';
    account: null;
}

/**
 * Creating embedded wallet state
 */
interface IEmbeddedWalletCreatingState {
    status: 'creating';
    account: null;
}

/**
 * Error embedded wallet state
 */
interface IEmbeddedWalletErrorState {
    status: 'error';
    account: OpenfortEthereumEmbeddedWalletAccount | null;
    error: string;
}

/**
 * Embedded wallet actions
 */
export type EmbeddedWalletActions = {
    /**
     * Create an embedded wallet for this user.
     */
    create: (args?: CreateOrRecoverEmbeddedWalletProps) => Promise<OpenfortEmbeddedWalletProvider | null>;

    /**
     * Return an EIP-1193 Provider for the Openfort embedded wallet.
     */
    getProvider: () => Promise<OpenfortEmbeddedWalletProvider>;
};

// Combined embedded wallet state types
export type EmbeddedWalletConnectedState = EmbeddedWalletActions & IEmbeddedWalletConnectedState;
export type EmbeddedWalletConnectingState = EmbeddedWalletActions & IEmbeddedWalletConnectingState;
export type EmbeddedWalletReconnectingState = EmbeddedWalletActions & IEmbeddedWalletReconnectingState;
export type EmbeddedWalletDisconnectedState = EmbeddedWalletActions & IEmbeddedWalletDisconnectedState;
export type EmbeddedWalletNeedsRecoveryState = EmbeddedWalletActions & IEmbeddedWalletNeedsRecoveryState;
export type EmbeddedWalletNotCreatedState = EmbeddedWalletActions & IEmbeddedWalletNotCreatedState;
export type EmbeddedWalletCreatingState = EmbeddedWalletActions & IEmbeddedWalletCreatingState;
export type EmbeddedWalletErrorState = EmbeddedWalletActions & IEmbeddedWalletErrorState;

/**
 * Main embedded wallet state union
 */
export type EmbeddedWalletState =
    | EmbeddedWalletConnectedState
    | EmbeddedWalletConnectingState
    | EmbeddedWalletReconnectingState
    | EmbeddedWalletDisconnectedState
    | EmbeddedWalletNeedsRecoveryState
    | EmbeddedWalletCreatingState
    | EmbeddedWalletNotCreatedState
    | EmbeddedWalletErrorState;

/**
 * Embedded wallet status
 */
export type EmbeddedWalletStatus = EmbeddedWalletState['status'];

// Embedded Solana Wallet State Interfaces

/**
 * Connected embedded Solana wallet state
 */
interface IEmbeddedSolanaWalletConnectedState {
    status: 'connected';
}

/**
 * Connecting embedded Solana wallet state
 */
interface IEmbeddedSolanaWalletConnectingState {
    status: 'connecting';
}

/**
 * Reconnecting embedded Solana wallet state
 */
interface IEmbeddedSolanaWalletReconnectingState {
    status: 'reconnecting';
}

/**
 * Disconnected embedded Solana wallet state
 */
interface IEmbeddedSolanaWalletDisconnectedState {
    status: 'disconnected';
}

/**
 * Needs recovery embedded Solana wallet state
 */
interface IEmbeddedSolanaWalletNeedsRecoveryState {
    status: 'needs-recovery';
}

/**
 * Not created embedded Solana wallet state
 */
interface IEmbeddedSolanaWalletNotCreatedState {
    status: 'not-created';
}

/**
 * Creating embedded Solana wallet state
 */
interface IEmbeddedSolanaWalletCreatingState {
    status: 'creating';
}

/**
 * Error embedded Solana wallet state
 */
interface IEmbeddedSolanaWalletErrorState {
    status: 'error';
    error: string;
}

/**
 * Connected embedded Solana wallet
 */
export type ConnectedEmbeddedSolanaWallet = {
    address: string;
    publicKey: string;
    walletIndex: number;
    getProvider: () => Promise<OpenfortEmbeddedSolanaWalletProvider>;
};

/**
 * Embedded Solana wallet actions
 */
export type EmbeddedSolanaWalletActions = {
    /**
     * Create an embedded wallet for this user.
     */
    create: (args?: CreateSolanaEmbeddedWalletOpts) => Promise<OpenfortEmbeddedSolanaWalletProvider | null>;

    /**
     * List of embedded solana wallets at each derived HD index.
     */
    wallets: ConnectedEmbeddedSolanaWallet[];
};

// Combined embedded Solana wallet state types
export type EmbeddedSolanaWalletConnectedState = EmbeddedSolanaWalletActions & IEmbeddedSolanaWalletConnectedState;
export type EmbeddedSolanaWalletConnectingState = EmbeddedSolanaWalletActions & IEmbeddedSolanaWalletConnectingState;
export type EmbeddedSolanaWalletReconnectingState = EmbeddedSolanaWalletActions & IEmbeddedSolanaWalletReconnectingState;
export type EmbeddedSolanaWalletDisconnectedState = Partial<EmbeddedSolanaWalletActions> & IEmbeddedSolanaWalletDisconnectedState;
export type EmbeddedSolanaWalletNeedsRecoveryState = EmbeddedSolanaWalletActions & IEmbeddedSolanaWalletNeedsRecoveryState;
export type EmbeddedSolanaWalletNotCreatedState = EmbeddedSolanaWalletActions & IEmbeddedSolanaWalletNotCreatedState;
export type EmbeddedSolanaWalletCreatingState = EmbeddedSolanaWalletActions & IEmbeddedSolanaWalletCreatingState;
export type EmbeddedSolanaWalletErrorState = EmbeddedSolanaWalletActions & IEmbeddedSolanaWalletErrorState;

/**
 * Main embedded Solana wallet state union
 */
export type EmbeddedSolanaWalletState =
    | EmbeddedSolanaWalletConnectedState
    | EmbeddedSolanaWalletConnectingState
    | EmbeddedSolanaWalletReconnectingState
    | EmbeddedSolanaWalletDisconnectedState
    | EmbeddedSolanaWalletNeedsRecoveryState
    | EmbeddedSolanaWalletCreatingState
    | EmbeddedSolanaWalletNotCreatedState
    | EmbeddedSolanaWalletErrorState;

/**
 * Embedded Solana wallet status
 */
export type EmbeddedSolanaWalletStatus = EmbeddedSolanaWalletState['status'];

// Connected wallet types for different chains

/**
 * Connected Ethereum wallet
 */
export type ConnectedEthereumWallet = {
    address: string;
    walletIndex: number;
    chainType: 'ethereum';
    getProvider: () => Promise<OpenfortEmbeddedWalletProvider>;
};