import { useCallback } from "react";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type CreateWalletPostAuthOptions = {};

// this hook is used to create a wallet after the user has authenticated
export const useCreateWalletPostAuth = () => {

  // This would connect to the wallet and set it as active
  // eslint-disable-next-line no-empty-pattern
  const tryUseWallet = useCallback(async ({ /* logoutOnError: signOutOnError = true, automaticRecovery = true */ }: CreateWalletPostAuthOptions) => {
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

    return { wallet: undefined };
  }, [/* walletConfig, setActiveWallet, signOut */]);

  return {
    tryUseWallet,
  }
}