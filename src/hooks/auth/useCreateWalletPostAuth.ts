import { useCallback } from 'react'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type CreateWalletPostAuthOptions = any

/**
 * Hook for creating wallets after user authentication.
 *
 * TODO: the implementation is currently a placeholder that always returns an
 * undefined wallet. Once the post-auth wallet flow is wired up, this helper will
 * attempt to provision or connect an embedded wallet automatically.
 *
 * @returns Object containing wallet creation utilities (placeholder for now).
 */
const _useCreateWalletPostAuth = () => {
  // This would connect to the wallet and set it as active
  // eslint-disable-next-line no-empty-pattern
  const tryUseWallet = useCallback(
    // async ({/* logoutOnError: signOutOnError = true, automaticRecovery = true */}: CreateWalletPostAuthOptions) => {
    async (_props: CreateWalletPostAuthOptions) => {
      // if (!walletConfig || walletConfig.recoveryMethod !== RecoveryMethod.AUTOMATIC || !automaticRecovery) {
      //   return {};
      // }

      // const wallet = await setActiveWallet({
      //   connector: embeddedWalletId,
      // });

      // if (wallet.error && signOutOnError) {
      //   // If there was an error and we should log out, we can call the logout function
      //   await signOut();
      // }

      return { wallet: undefined }
    },
    [
      /* walletConfig, setActiveWallet, signOut */
    ]
  )

  return {
    tryUseWallet,
  }
}
