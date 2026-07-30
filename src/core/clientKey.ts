import type { ThirdPartyAuthConfiguration } from '@openfort/openfort-js'
import type { SDKOverrides } from './client'
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
 * Recursively sorts object keys so semantically-equal objects serialize to
 * the same string regardless of the order a caller constructed them in.
 * Non-serializable values (functions, undefined) are still dropped by
 * JSON.stringify afterwards, exactly as before.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep)
  }
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort()) {
      sorted[key] = sortKeysDeep(source[key])
    }
    return sorted
  }
  return value
}

/**
 * Computes a stable identity key for the client configuration.
 *
 * Recreating the client tears down the embedded wallet connection, so it must
 * only happen when the configuration meaningfully changes — not when a parent
 * re-render passes a new inline object with the same contents (key order
 * included: the inputs are normalized with a deep key sort so `overrides`/
 * `thirdPartyAuth` construction order can't churn the key). Only serializable
 * fields participate; JSON.stringify drops functions, so callback props
 * (e.g. `getEncryptionSession`) keep per-render identity without churning
 * the key.
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
  return JSON.stringify(
    sortKeysDeep({
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
  )
}
