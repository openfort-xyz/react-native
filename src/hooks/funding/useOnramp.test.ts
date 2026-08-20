import type { FundingSession } from '@openfort/openfort-js'
import { describe, expect, it, vi } from 'vitest'

// The hook module pulls the expo browser/linking natives through native/oauth;
// the pure flow under test never touches them.
vi.mock('../../native/oauth', () => ({
  createOAuthRedirectUri: () => 'myapp://openfort/onramp',
  openOAuthSession: vi.fn(async () => ({ type: 'cancel' })),
}))

import { type OnrampFundingSurface, resolveOnrampSurface, runPopupOnramp } from './useOnramp'

const TARGET = { chain: 'eip155:8453', currency: '0xUSDC', address: '0xWALLET' }

const sessionAt = (status: FundingSession['status'], paymentMethod: unknown = null): FundingSession =>
  ({
    id: 'fnd_1',
    clientSecret: 'cs_1',
    target: TARGET,
    status,
    amountUnits: null,
    metadata: null,
    externalId: null,
    createdAt: 0,
    expiresAt: 0,
    paymentMethod,
  }) as unknown as FundingSession

const POPUP_PM = { type: 'onramp', method: 'card', angle: 'popup', url: 'https://pay.example/checkout' }

function surfaceWith(overrides?: Partial<OnrampFundingSurface['sessions']>): OnrampFundingSurface {
  return {
    sessions: {
      create: vi.fn(async () => sessionAt('requires_payment_method')),
      setPaymentMethod: vi.fn(async () => sessionAt('waiting_payment', POPUP_PM)),
      get: vi.fn(async () => sessionAt('succeeded', POPUP_PM)),
      quote: vi.fn(),
      ...overrides,
    },
    methods: vi.fn(async () => ({ country: 'US', methods: [] })),
  }
}

describe('resolveOnrampSurface', () => {
  it('rejects an SDK that predates any part of the onramp surface', () => {
    expect(resolveOnrampSurface(undefined)).toBeNull()
    expect(resolveOnrampSurface(null)).toBeNull()
    // openfort-js 1.x/2.1 shape: sessions without quote, no sessionless methods.
    const partial = { sessions: { create: () => {}, setPaymentMethod: () => {}, get: () => {} } }
    expect(resolveOnrampSurface(partial)).toBeNull()
  })

  it('adopts a complete surface', () => {
    const surface = surfaceWith()
    expect(resolveOnrampSurface(surface)).toBe(surface)
  })
})

describe('runPopupOnramp', () => {
  const deps = (funding: OnrampFundingSurface, present = vi.fn(async () => ({ type: 'cancel' }))) => ({
    funding,
    present,
    onUpdate: vi.fn(),
    isCurrent: () => true,
  })

  it('commits with the popup-only capability declaration and polls to terminal', async () => {
    const funding = surfaceWith()
    const d = deps(funding)
    vi.useFakeTimers()
    const flow = runPopupOnramp(d, TARGET, { method: 'card', sourceAmount: '25.00', redirectUrl: 'myapp://onramp' })
    await vi.advanceTimersByTimeAsync(4000)
    const terminal = await flow
    vi.useRealTimers()

    expect(terminal.status).toBe('succeeded')
    const commit = (funding.sessions.setPaymentMethod as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(commit[0]).toBe('fnd_1')
    expect(commit[1].paymentMethod).toMatchObject({
      type: 'onramp',
      method: 'card',
      angles: ['popup'],
      redirectUrl: 'myapp://onramp',
    })
    expect(d.present).toHaveBeenCalledWith('https://pay.example/checkout', 'myapp://onramp')
  })

  it('keeps polling when the buyer closes the sheet — closing is not an outcome', async () => {
    const funding = surfaceWith({
      get: vi
        .fn()
        .mockResolvedValueOnce(sessionAt('processing', POPUP_PM))
        .mockResolvedValueOnce(sessionAt('succeeded', POPUP_PM)),
    })
    // The sheet "cancels" immediately; settlement lands two polls later.
    const d = deps(
      funding,
      vi.fn(async () => ({ type: 'cancel' }))
    )
    vi.useFakeTimers()
    const flow = runPopupOnramp(d, TARGET, { method: 'card', redirectUrl: 'myapp://onramp' })
    await vi.advanceTimersByTimeAsync(8000)
    const terminal = await flow
    vi.useRealTimers()
    expect(terminal.status).toBe('succeeded')
    expect(funding.sessions.get).toHaveBeenCalledTimes(2)
  })

  it('fails loudly when the commit resolves no hosted checkout url', async () => {
    const funding = surfaceWith({
      setPaymentMethod: vi.fn(async () => sessionAt('waiting_payment', { ...POPUP_PM, url: null })),
    })
    await expect(runPopupOnramp(deps(funding), TARGET, { method: 'card', redirectUrl: 'myapp://x' })).rejects.toThrow(
      /no hosted checkout url/
    )
  })

  it('a presenter rejection does not sink the flow', async () => {
    const funding = surfaceWith()
    const d = deps(
      funding,
      vi.fn(async () => {
        throw new Error('browser died')
      })
    )
    vi.useFakeTimers()
    const flow = runPopupOnramp(d, TARGET, { method: 'card', redirectUrl: 'myapp://onramp' })
    await vi.advanceTimersByTimeAsync(4000)
    await expect(flow).resolves.toMatchObject({ status: 'succeeded' })
    vi.useRealTimers()
  })
})
