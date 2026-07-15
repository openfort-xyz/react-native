import type { Chain } from '../core/provider'

/**
 * Validates the `supportedChains` prop passed to {@link OpenfortProvider}.
 *
 * `supportedChains` must be an array of full viem `Chain` objects (e.g.
 * `import { polygonAmoy } from 'viem/chains'`), not raw chain-ID numbers.
 * Without this guard a malformed value (such as `[80002]`) is accepted
 * silently: the provider builds, but the internal chainId -> rpcUrl map ends
 * up empty because each entry lacks `rpcUrls.default.http`, so every chain
 * lookup breaks with no error. This surfaces the misconfiguration at provider
 * mount with an explicit, actionable message.
 *
 * @param supportedChains - The value passed as the `supportedChains` prop.
 * @throws Error if the value is not an array of valid Chain objects.
 */
export function validateSupportedChains(supportedChains: unknown): void {
  if (supportedChains === undefined) return

  if (!Array.isArray(supportedChains)) {
    throw new Error(
      `[Openfort SDK] "supportedChains" must be an array of viem Chain objects, but received ${typeof supportedChains}. ` +
        `Import full chain objects (e.g. import { polygonAmoy } from 'viem/chains'), not raw chain IDs.`
    )
  }

  supportedChains.forEach((chain, index) => {
    const isChainObject =
      chain !== null &&
      typeof chain === 'object' &&
      typeof (chain as Chain).id === 'number' &&
      typeof (chain as Chain).rpcUrls?.default?.http?.[0] === 'string'

    if (!isChainObject) {
      const received =
        chain !== null && typeof chain === 'object'
          ? JSON.stringify(chain)
          : `${typeof chain} (${String(chain)})`
      throw new Error(
        `[Openfort SDK] "supportedChains[${index}]" is not a valid Chain object (received ${received}). ` +
          `Pass full viem Chain objects with an "id" and "rpcUrls.default.http" ` +
          `(e.g. import { polygonAmoy } from 'viem/chains'), not raw chain IDs.`
      )
    }
  })
}
