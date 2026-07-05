import type { SDKOverrides, ThirdPartyAuthConfiguration } from '@openfort/openfort-js'
import type { EmbeddedWalletConfiguration } from './provider'

/**
 * Inputs that determine whether the Openfort client must be recreated.
 */
export interface ClientConfigKeyInputs {
  publishableKey: string
  walletConfig?: EmbeddedWalletConfiguration
  overrides?: SDKOverrides
  thirdPartyAuth?: ThirdPartyAuthConfiguration
}

/**
 * Computes a stable identity key for the client configuration.
 *
 * Recreating the client tears down the embedded wallet connection, so it must
 * only happen when the configuration meaningfully changes — not when a parent
 * re-render passes a new inline object with the same contents. Only
 * serializable fields participate; JSON.stringify drops functions, so callback
 * props (e.g. `getEncryptionSession`) keep per-render identity without
 * churning the key.
 *
 * @param inputs - Provider props that feed client creation.
 * @returns A string that changes only when the client must be rebuilt.
 */
export function computeClientConfigKey({
  publishableKey,
  walletConfig,
  overrides,
  thirdPartyAuth,
}: ClientConfigKeyInputs): string {
  return JSON.stringify({
    publishableKey,
    walletConfig: walletConfig
      ? {
          shieldPublishableKey: walletConfig.shieldPublishableKey,
          debug: walletConfig.debug,
          accountType: walletConfig.accountType,
          recoveryMethod: walletConfig.recoveryMethod,
          passkeyRpId: walletConfig.passkeyRpId,
          passkeyRpName: walletConfig.passkeyRpName,
          passkeyDisplayName: walletConfig.passkeyDisplayName,
          feeSponsorshipId: walletConfig.feeSponsorshipId,
          createEncryptedSessionEndpoint: walletConfig.createEncryptedSessionEndpoint,
        }
      : undefined,
    overrides,
    thirdPartyAuth,
  })
}
