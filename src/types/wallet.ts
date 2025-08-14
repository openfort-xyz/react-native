/* eslint-disable @typescript-eslint/no-explicit-any */
// Embedded wallet provider types
export interface OpenfortEmbeddedEthereumWalletProvider {
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    on: (event: string, handler: (...args: any[]) => void) => void;
    removeListener: (event: string, handler: (...args: any[]) => void) => void;
    [key: string]: any;
}

export interface OpenfortEmbeddedSolanaWalletProvider {
    signTransaction: (transaction: any) => Promise<any>;
    signAllTransactions: (transactions: any[]) => Promise<any[]>;
    publicKey: string;
    [key: string]: any;
}

// Embedded wallet account types
export interface OpenfortEthereumEmbeddedWalletAccount {
    address: string;
    ownerAddress?: string;
    implementationType?: string;
    chainType: 'ethereum';
    walletIndex: number;
}

export interface OpenfortSolanaEmbeddedWalletAccount {
    address: string;
    chainType: 'solana';
    walletIndex: number;
}

import { ChainTypeEnum } from '@openfort/openfort-js';
import type { ErrorCallback } from './auth';
import { Hex } from './hex';

/**
 * Openfort embedded wallet account union type
 */
export type OpenfortEmbeddedWalletAccount =
    | OpenfortEthereumEmbeddedWalletAccount
    | OpenfortSolanaEmbeddedWalletAccount

/**
 * Wallet recovery callbacks
 */
export type WalletRecoveryCallbacks = {
    onError?: ErrorCallback;
    onSuccess?: (provider: OpenfortEmbeddedEthereumWalletProvider) => void;
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

export type UserWallet = {
    address: Hex;
    ownerAddress?: string;
    implementationType?: string;
    chainType: ChainTypeEnum;
    isActive?: boolean;
    isConnecting?: boolean;
    getProvider: () => Promise<OpenfortEmbeddedEthereumWalletProvider>;
};
/**
 * Connected embedded wallet state
 */
interface IEmbeddedEthereumWalletConnectedState {
    status: 'connected';
    provider: OpenfortEmbeddedEthereumWalletProvider;
    activeWallet: UserWallet;
}

/**
 * Connecting embedded wallet state
 */
interface IEmbeddedEthereumWalletConnectingState {
    status: 'connecting';
    activeWallet: UserWallet;
}

/**
 * Reconnecting embedded wallet state
 */
interface IEmbeddedEthereumWalletReconnectingState {
    status: 'reconnecting';
    activeWallet: UserWallet;
}

/**
 * Disconnected embedded wallet state
 */
interface IEmbeddedEthereumWalletDisconnectedState {
    status: 'disconnected';
    activeWallet: null;
}

/**
 * Needs recovery embedded wallet state
 */
interface IEmbeddedEthereumWalletNeedsRecoveryState {
    status: 'needs-recovery';
    activeWallet: UserWallet;
}

/**
 * Creating embedded wallet state
 */
interface IEmbeddedEthereumWalletCreatingState {
    status: 'creating';
    activeWallet: null;
}

/**
 * Error embedded wallet state
 */
interface IEmbeddedEthereumWalletErrorState {
    status: 'error';
    activeWallet: UserWallet | null;
    error: string;
}

/**
 * Embedded wallet actions
 */
export type EmbeddedEthereumWalletActions = {
    /**
     * Configure an embedded wallet for this user.
     */
    create: (args?: { chainId?: number; recoveryPassword?: string; policyId?: string }) => Promise<import('@openfort/openfort-js').EmbeddedAccount>;

    /**
     * List of embedded ethereum wallets at each derived HD index.
     */
    wallets: ConnectedEmbeddedEthereumWallet[];
};

// Combined embedded wallet state types
// export type EmbeddedEthereumWalletConnectedState = EmbeddedEthereumWalletActions & IEmbeddedEthereumWalletConnectedState;
// export type EmbeddedEthereumWalletConnectingState = EmbeddedEthereumWalletActions & IEmbeddedEthereumWalletConnectingState;
// export type EmbeddedEthereumWalletReconnectingState = EmbeddedEthereumWalletActions & IEmbeddedEthereumWalletReconnectingState;
// export type EmbeddedEthereumWalletDisconnectedState = EmbeddedEthereumWalletActions & IEmbeddedEthereumWalletDisconnectedState;
// export type EmbeddedEthereumWalletNeedsRecoveryState = EmbeddedEthereumWalletActions & IEmbeddedEthereumWalletNeedsRecoveryState;
// export type EmbeddedEthereumWalletCreatingState = EmbeddedEthereumWalletActions & IEmbeddedEthereumWalletCreatingState;
// export type EmbeddedEthereumWalletErrorState = EmbeddedEthereumWalletActions & IEmbeddedEthereumWalletErrorState;

export type EthereumWalletState =
    | IEmbeddedEthereumWalletConnectedState
    | IEmbeddedEthereumWalletConnectingState
    | IEmbeddedEthereumWalletReconnectingState
    | IEmbeddedEthereumWalletDisconnectedState
    | IEmbeddedEthereumWalletNeedsRecoveryState
    | IEmbeddedEthereumWalletCreatingState
    | IEmbeddedEthereumWalletErrorState;

/**
 * Main embedded wallet state union
 */
export type EmbeddedEthereumWalletState = EthereumWalletState & EmbeddedEthereumWalletActions

/**
 * Embedded wallet status
 */
export type EmbeddedWalletStatus = EmbeddedEthereumWalletState['status'];

// Embedded Solana Wallet State Interfaces

/**
 * Connected embedded Solana wallet state
 */
interface IEmbeddedSolanaWalletConnectedState {
    status: 'connected';
    activeWallet: OpenfortSolanaEmbeddedWalletAccount;
    provider: OpenfortEmbeddedEthereumWalletProvider;
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
    activeWallet: OpenfortSolanaEmbeddedWalletAccount;
}

/**
 * Disconnected embedded Solana wallet state
 */
interface IEmbeddedSolanaWalletDisconnectedState {
    status: 'disconnected';
    activeWallet: null;
}

/**
 * Needs recovery embedded Solana wallet state
 */
interface IEmbeddedSolanaWalletNeedsRecoveryState {
    status: 'needs-recovery';
    activeWallet: OpenfortSolanaEmbeddedWalletAccount;
}

/**
 * Creating embedded Solana wallet state
 */
interface IEmbeddedSolanaWalletCreatingState {
    status: 'creating';
    activeWallet: null;
}

/**
 * Error embedded Solana wallet state
 */
interface IEmbeddedSolanaWalletErrorState {
    status: 'error';
    activeWallet: OpenfortSolanaEmbeddedWalletAccount | null;
    error: string;
}

/**
 * Connected embedded Solana wallet
 */
export type ConnectedEmbeddedSolanaWallet = {
    address: string;
    chainType: 'solana';
    walletIndex: number;
    getProvider: () => Promise<OpenfortEmbeddedSolanaWalletProvider>;
};

/**
 * Embedded Solana wallet actions
 */
export type EmbeddedSolanaWalletActions = {
    /**
     * Configure an embedded wallet for this user.
     */
    create: (args?: { chainId?: number; recoveryPassword?: string }) => Promise<import('@openfort/openfort-js').EmbeddedAccount>;

    /**
     * List of embedded solana wallets
     */
    wallets: ConnectedEmbeddedSolanaWallet[];
};

// Combined embedded Solana wallet state types
export type EmbeddedSolanaWalletConnectedState = EmbeddedSolanaWalletActions & IEmbeddedSolanaWalletConnectedState;
export type EmbeddedSolanaWalletConnectingState = EmbeddedSolanaWalletActions & IEmbeddedSolanaWalletConnectingState;
export type EmbeddedSolanaWalletReconnectingState = EmbeddedSolanaWalletActions & IEmbeddedSolanaWalletReconnectingState;
export type EmbeddedSolanaWalletDisconnectedState = Partial<EmbeddedSolanaWalletActions> & IEmbeddedSolanaWalletDisconnectedState;
export type EmbeddedSolanaWalletNeedsRecoveryState = EmbeddedSolanaWalletActions & IEmbeddedSolanaWalletNeedsRecoveryState;
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
    | EmbeddedSolanaWalletErrorState;

/**
 * Embedded Solana wallet status
 */
export type EmbeddedSolanaWalletStatus = EmbeddedSolanaWalletState['status'];

// Connected wallet types for different chains

/**
 * Connected Ethereum wallet
 */
export type ConnectedEmbeddedEthereumWallet = {
    address: string;
    ownerAddress?: string;
    implementationType?: string;
    chainType: 'ethereum';
    walletIndex: number;
    getProvider: () => Promise<OpenfortEmbeddedEthereumWalletProvider>;
};