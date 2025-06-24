/**
 * Hook for embedded Ethereum wallet functionality
 */
import { useCallback } from 'react';
import type { AuthPlayerResponse as OpenfortUser } from '@openfort/openfort-js';
import { useOpenfortContext } from '../../core/context';
import type {
  ConnectedEthereumWallet,
  UseEmbeddedEthereumWallet,
} from '../../types';

/**
 * Hook for interacting with embedded Ethereum wallets
 * 
 * @returns Object with wallets array and create function
 * 
 * @example
 * ```tsx
 * const { wallets, create } = useEmbeddedEthereumWallet();
 * 
 * // Create the first Ethereum wallet
 * if (wallets.length === 0) {
 *   const { user } = await create();
 *   console.log('Created wallet for user:', user.id);
 * }
 * 
 * // Create an additional wallet
 * const { user } = await create({ createAdditional: true });
 * 
 * // Use the first wallet
 * if (wallets.length > 0) {
 *   const provider = await wallets[0].getProvider();
 *   // Use provider for transactions
 * }
 * ```
 */
export function useEmbeddedEthereumWallet(): UseEmbeddedEthereumWallet {
  const { client, user } = useOpenfortContext();

  // Extract Ethereum wallets from user
  const wallets: ConnectedEthereumWallet[] = user?.linked_accounts
    ?.filter((account): account is any =>
      account.type === 'wallet' &&
      account.chain_type === 'ethereum' &&
      account.wallet_client === 'automatic'
    )
    ?.map((account, index) => ({
      address: account.address,
      walletIndex: account.wallet_index || index,
      chainType: 'ethereum' as const,
      getProvider: async () => {
        return await client.embedded.ethereum.getProvider();
      },
    })) || [];

  const create = useCallback(
    async (opts?: { createAdditional?: boolean }): Promise<{ user: OpenfortUser }> => {
      try {
        const result = await client.embedded.ethereum.create({
          createAdditional: opts?.createAdditional,
        });

        return { user: result.user };
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to create Ethereum wallet');
        throw errorObj;
      }
    },
    [client]
  );

  return {
    wallets,
    create,
  };
}