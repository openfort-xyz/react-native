import { describe, expect, it } from 'vitest'
import type { Chain } from '../core/provider'
import { validateSupportedChains } from './chainValidation'

const validChain: Chain = {
  id: 80002,
  name: 'Polygon Amoy',
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc-amoy.polygon.technology'] } },
}

describe('validateSupportedChains', () => {
  it('accepts undefined (prop is optional)', () => {
    expect(() => validateSupportedChains(undefined)).not.toThrow()
  })

  it('accepts an array of valid Chain objects', () => {
    expect(() => validateSupportedChains([validChain])).not.toThrow()
  })

  it('throws when given raw chain IDs instead of Chain objects', () => {
    expect(() => validateSupportedChains([80002])).toThrow(/not a valid Chain object/)
  })

  it('throws when a Chain object is missing rpcUrls', () => {
    const { rpcUrls, ...withoutRpc } = validChain
    void rpcUrls
    expect(() => validateSupportedChains([withoutRpc])).toThrow(/supportedChains\[0\]/)
  })

  it('throws when the value is not an array', () => {
    expect(() => validateSupportedChains(80002)).toThrow(/must be an array/)
  })

  it('reports the index of the first invalid entry', () => {
    expect(() => validateSupportedChains([validChain, 80002])).toThrow(/supportedChains\[1\]/)
  })
})
