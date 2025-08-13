import { RecoveryMethod } from "@openfort/openfort-js"
import { useCallback } from "react"

export type CreateWalletPostAuthOptions = {
  /**
   * @default true
   * It will log out the user if there is an error while trying to create a wallet (automatic recovery).
   */
  // logoutOnError?: boolean;

  /**
   * 
   */
  // automaticRecovery?: boolean;
};

// this hook is used to create a wallet after the user has authenticated
export const useCreateWalletPostAuth = () => {

  // This would connect to the wallet and set it as active
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