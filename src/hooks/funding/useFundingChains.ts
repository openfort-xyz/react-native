import type { FundingApi, FundingChain, FundingCurrency } from '@openfort/openfort-js'
import { useEffect, useMemo, useState } from 'react'
import { useOpenfortClient } from '../core/useOpenfortClient'

/**
 * Source-chain hook for the funding (cross-chain deposit) flow.
 *
 * Fetches the chains/currencies the rail can route from
 * (`GET /v2/funding/chains`, a live passthrough of the provider's routes) and
 * narrows them to a curated subset for building a source picker. A thin wrapper
 * over the openfort-js `funding` namespace (`client.funding`), mirroring
 * `useFunding` — no extra configuration needed.
 */

// Re-export the chain types consumers need to render a source picker, so they
// can be imported from `@openfort/react-native` alongside `useFundingChains`.
export type { FundingChain, FundingCurrency } from '@openfort/openfort-js'

export type UseFundingChains = {
  /** Source chains/currencies the rail can route from, curated to the selection. */
  chains: FundingChain[]
  loading: boolean
  error: Error | null
  /** True when the openfort-js funding namespace is available on the client. */
  isAvailable: boolean
}

/** Narrow the provider's full chain dictionary to a curated subset. */
export type UseFundingChainsOptions = {
  /** CAIP-2 allowlist (also defines order). Defaults to {@link DEFAULT_SOURCE_CHAINS}. */
  sourceChains?: string[]
  /**
   * Currency-symbol allowlist; the sentinel `'native'` matches each chain's
   * native currency. Defaults to {@link DEFAULT_SOURCE_CURRENCIES}.
   */
  sourceCurrencies?: string[]
}

/** Sensible default source chains — the common funding origins. */
export const DEFAULT_SOURCE_CHAINS = [
  'eip155:42161', // Arbitrum
  'eip155:8453', // Base
  'eip155:56', // BNB Chain
  'eip155:1', // Ethereum
  'eip155:10', // Optimism
  'eip155:137', // Polygon
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Solana
]

/** Default source currencies: each chain's native currency plus the major stablecoins. */
export const DEFAULT_SOURCE_CURRENCIES = ['native', 'USDC', 'USDT']

const NOT_AVAILABLE =
  'Funding is unavailable: the Openfort client is not initialized yet. Await waitForInitialization() before using funding.'

/**
 * Hook for the funding source chains/currencies.
 *
 * @param options - Optional `sourceChains` / `sourceCurrencies` allowlists to
 * narrow the provider dictionary. Defaults to {@link DEFAULT_SOURCE_CHAINS} and
 * {@link DEFAULT_SOURCE_CURRENCIES}.
 * @returns `chains` (curated), plus `loading` / `error` / `isAvailable`.
 *
 * @example
 * ```tsx
 * const { chains, loading } = useFundingChains();
 * // chains.flatMap((c) => c.currencies.map((cur) => ({ chain: c, cur })))
 * ```
 */
export function useFundingChains(options?: UseFundingChainsOptions): UseFundingChains {
  const client = useOpenfortClient()
  // The `funding` getter throws until the SDK has initialized; treat that as
  // "not available yet" rather than letting it crash render.
  const funding = useMemo<FundingApi | null>(() => {
    try {
      return client.funding
    } catch {
      return null
    }
  }, [client])
  const isAvailable = funding != null

  const sourceChains = options?.sourceChains ?? DEFAULT_SOURCE_CHAINS
  const sourceCurrencies = options?.sourceCurrencies ?? DEFAULT_SOURCE_CURRENCIES

  const [chains, setChains] = useState<FundingChain[]>([])
  const [loading, setLoading] = useState(isAvailable)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!funding) {
      setChains([])
      setLoading(false)
      setError(new Error(NOT_AVAILABLE))
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    funding
      .chains()
      .then((fetched) => {
        if (cancelled) return
        setChains(fetched)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setChains([])
        setError(e instanceof Error ? e : new Error(String(e)))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [funding])

  // Narrow the provider dictionary to the selected subset (cheap, O(chains)).
  const curated = useMemo(
    () => curateChains(chains, sourceChains, sourceCurrencies),
    [chains, sourceChains, sourceCurrencies]
  )
  return { chains: curated, loading, error, isAvailable }
}

/**
 * Narrow the fetched chains to a selection. `sourceChains` is a CAIP-2 allowlist
 * (also defines order); `sourceCurrencies` is a symbol allowlist where the
 * sentinel `'native'` matches each chain's native currency. Chains left with no
 * currency are dropped, and selected chains the rail doesn't support are skipped.
 */
export function curateChains(
  chains: FundingChain[],
  sourceChains: string[] | undefined,
  sourceCurrencies: string[] | undefined
): FundingChain[] {
  let out = chains
  if (sourceCurrencies && sourceCurrencies.length > 0) {
    const allow = new Set(sourceCurrencies.map((s) => s.toLowerCase()))
    const allowNative = allow.has('native')
    out = out
      .map((c) => ({
        ...c,
        currencies: c.currencies.filter(
          (cur: FundingCurrency) => (allowNative && cur.native) || allow.has(cur.symbol.toLowerCase())
        ),
      }))
      .filter((c) => c.currencies.length > 0)
  }
  if (sourceChains && sourceChains.length > 0) {
    const byId = new Map(out.map((c) => [c.id, c]))
    out = sourceChains.map((id) => byId.get(id)).filter((c): c is FundingChain => c !== undefined)
  }
  return out
}

/**
 * Nominal source amount (in base units) used only to mint an open, route-bound
 * deposit address. The open address accepts any amount >= the route minimum
 * afterward, so this is just a quote seed. Stablecoins use 1 whole unit (~$1,
 * clears mainnet route minimums); native tokens are far pricier per unit
 * (1 ETH ≈ thousands), so they use 0.01 of a unit to avoid prefilling 1 whole ETH.
 */
export function nominalUnits(decimals: number, native = false): string {
  const zeros = native ? Math.max(0, decimals - 2) : decimals
  return `1${'0'.repeat(zeros)}`
}
