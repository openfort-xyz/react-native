import type { FundingSession, FundingSessionStatus, FundingTarget } from '@openfort/openfort-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createOAuthRedirectUri, openOAuthSession } from '../../native/oauth'
import { useOpenfortClient } from '../core/useOpenfortClient'
import { pollUntilTerminal } from './useFunding'

/**
 * Fiat onramp hook for React Native — the popup angle only.
 *
 * React Native can execute exactly one of the onramp's integration angles: the
 * hosted checkout ("popup"), opened in a system browser sheet
 * (ASWebAuthenticationSession / Custom Tabs via expo-web-browser). The
 * `embedded` element flow needs a DOM and the `native` wallet-pay sheet needs a
 * Safari context, so every call here declares `angles: ['popup']` — the server
 * then routes methods it would otherwise resolve to those flows onto the hosted
 * checkout instead, and never returns a commit this client cannot execute.
 *
 * The onramp types below mirror `@openfort/openfort-js` ≥ 2.2; the surface is
 * probed structurally because this package's installed SDK major predates it.
 * Once the dependency is bumped, these become re-exports.
 */

/** Backend ids of the fiat (web2) funding methods. */
export type OnrampMethodId = 'apple_pay' | 'google_pay' | 'card' | 'bank_transfer'

/** One resolved fiat method row. The provider is auto-selected and never shown. */
export type ResolvedOnrampMethod = {
  method: OnrampMethodId | string
  /** Executing provider — for telemetry only, never display. */
  provider: string
  /** Always "popup" for rows resolved through this hook. */
  angle: string
  /** Display label derived from `method` + `rail`. */
  label?: string
  /** Regional bank rail for bank transfers ("ach" | "sepa" | "interac"). */
  rail?: string
}

/** Resolved fiat methods for a destination + the buyer's region. */
export type ResolvedOnrampMethods = {
  /** Resolved ISO-3166 alpha-2 country, or null for rest-of-world. */
  country: string | null
  methods: ResolvedOnrampMethod[]
}

/** A priced onramp route: what the entered fiat buys after fees. */
export type OnrampQuote = {
  provider?: string
  sourceAmount: string
  sourceCurrency: string
  destinationAmount: string
  destinationCurrency: string
  destinationNetwork: string
  fees: Array<{ type: string; amount: string; currency: string }>
  exchangeRate: string
}

/** Parameters for committing a hosted-checkout purchase. */
export type OnrampOpenParams = {
  /** The fiat method the user picked (from `methods()`). */
  method: OnrampMethodId
  /** Fiat amount to prefill in the checkout, human units (e.g. "25.00"). */
  sourceAmount?: string
  /** ISO-4217 fiat currency for `sourceAmount`. */
  sourceCurrency?: string
  /** Buyer-country override (ISO-3166 alpha-2); defaults to the request IP. */
  country?: string
  /**
   * Deep link the hosted checkout redirects back to, closing the browser
   * sheet. Defaults to the app's own scheme (`Linking.createURL`). Closing the
   * sheet is NOT a purchase outcome — settlement is webhook-driven and the
   * session keeps polling either way.
   */
  redirectUrl?: string
}

/** The client can only execute the hosted checkout — declared on every call. */
const RN_ANGLES = ['popup'] as const

/**
 * The `openfort.funding` onramp members this hook needs, as shipped in
 * `@openfort/openfort-js` ≥ 2.2. `paymentMethod` is typed loosely because the
 * installed SDK major predates the onramp input union.
 */
export type OnrampFundingSurface = {
  sessions: {
    create(params: { target: FundingTarget }): Promise<FundingSession>
    setPaymentMethod(
      id: string,
      params: { clientSecret: string; paymentMethod: Record<string, unknown> }
    ): Promise<FundingSession>
    get(id: string, params: { clientSecret: string }): Promise<FundingSession>
    quote(
      id: string,
      params: {
        method: OnrampMethodId
        sourceAmount: string
        sourceCurrency: string
        country?: string
        angles?: readonly string[]
        clientSecret?: string
      }
    ): Promise<OnrampQuote>
  }
  methods(params: {
    targetChain: string
    targetCurrency: string
    country?: string
    angles?: readonly string[]
  }): Promise<ResolvedOnrampMethods>
}

const isFn = (value: unknown): value is (...args: never[]) => unknown => typeof value === 'function'

/**
 * Structurally probe a client's `funding` namespace for the onramp surface.
 * All-or-nothing: an SDK with sessions but no sessionless `methods()` predates
 * the onramp client and is treated as unavailable.
 */
export function resolveOnrampSurface(candidate: unknown): OnrampFundingSurface | null {
  const funding = candidate as OnrampFundingSurface | null | undefined
  const sessions = funding?.sessions
  const complete =
    sessions &&
    isFn(sessions.create) &&
    isFn(sessions.setPaymentMethod) &&
    isFn(sessions.get) &&
    isFn(sessions.quote) &&
    isFn(funding?.methods)
  return complete ? (funding as OnrampFundingSurface) : null
}

/** How `open()` presents the hosted checkout URL — injected so tests need no browser. */
export type OnrampPresenter = (url: string, redirectUrl: string) => Promise<unknown>

/**
 * The full popup flow as a pure function: create a session, commit the method
 * with the popup-only capability declaration, present the hosted checkout, and
 * poll the session to a terminal status. Presentation and polling overlap — the
 * sheet closing (or redirecting back) is not an outcome, so the poll result is
 * the only truth.
 */
export async function runPopupOnramp(
  deps: {
    funding: OnrampFundingSurface
    present: OnrampPresenter
    onUpdate: (session: FundingSession) => void
    isCurrent: () => boolean
  },
  target: FundingTarget,
  params: OnrampOpenParams & { redirectUrl: string }
): Promise<FundingSession> {
  const { funding, present, onUpdate, isCurrent } = deps
  const created = await funding.sessions.create({ target })
  const committed = await funding.sessions.setPaymentMethod(created.id, {
    clientSecret: created.clientSecret,
    paymentMethod: {
      type: 'onramp',
      method: params.method,
      sourceAmount: params.sourceAmount,
      sourceCurrency: params.sourceCurrency,
      country: params.country,
      redirectUrl: params.redirectUrl,
      angles: [...RN_ANGLES],
    },
  })
  if (!isCurrent()) return committed
  onUpdate(committed)
  const pm = committed.paymentMethod
  const url = pm && pm.type === 'onramp' && 'url' in pm ? (pm as { url: string | null }).url : null
  if (!url) {
    throw new Error(
      `Onramp commit resolved no hosted checkout url (angle: ${
        pm && 'angle' in pm ? (pm as { angle?: string }).angle : 'none'
      }). The popup-only capability declaration should make this impossible — check the API deployment.`
    )
  }
  // Fire-and-forget: the sheet resolves when the checkout redirects back or the
  // buyer closes it. Neither ends the purchase — settlement may land after.
  void present(url, params.redirectUrl).catch(() => undefined)
  return pollUntilTerminal(funding, onUpdate, committed, isCurrent)
}

export type UseOnramp = {
  session: FundingSession | null
  status: FundingSessionStatus | 'idle'
  error: Error | null
  /** True while a session is being created and committed. */
  loading: boolean
  /** True when the installed openfort-js exposes the onramp surface. */
  isAvailable: boolean
  /** The fiat methods available for a destination and the buyer's region. */
  methods: (
    target: Pick<FundingTarget, 'chain' | 'currency'>,
    opts?: { country?: string }
  ) => Promise<ResolvedOnrampMethods>
  /** Price a committed-or-not route for an existing session. */
  quote: (
    session: { id: string; clientSecret: string },
    params: { method: OnrampMethodId; sourceAmount: string; sourceCurrency: string; country?: string }
  ) => Promise<OnrampQuote>
  /**
   * Create a session, commit the method, open the hosted checkout in the
   * system browser sheet, and resolve when the session reaches a terminal
   * status (`succeeded`, `bounced`, `expired`).
   */
  open: (target: FundingTarget, params: OnrampOpenParams) => Promise<FundingSession>
  /** Re-open the hosted checkout committed by the last `open()`. */
  present: () => void
  /** Reset to the idle state. */
  reset: () => void
}

const NOT_AVAILABLE =
  'Onramp is unavailable: the installed @openfort/openfort-js has no onramp client (needs >= 2.2), or the Openfort client is not initialized yet.'

/**
 * Headless fiat onramp for React Native.
 *
 * @example
 * ```tsx
 * const onramp = useOnramp();
 * const { methods } = await onramp.methods({ chain: 'eip155:8453', currency: USDC });
 * const session = await onramp.open(
 *   { chain: 'eip155:8453', currency: USDC, address },
 *   { method: methods[0].method, sourceAmount: '25.00', sourceCurrency: 'USD' },
 * );
 * if (session.status === 'succeeded') celebrate();
 * ```
 */
export function useOnramp(): UseOnramp {
  const client = useOpenfortClient()
  // The `funding` getter throws until the SDK has initialized; treat that as
  // "not available yet" rather than letting it crash render.
  const funding = useMemo<OnrampFundingSurface | null>(() => {
    try {
      return resolveOnrampSurface((client as unknown as { funding?: unknown }).funding)
    } catch {
      return null
    }
  }, [client])
  const isAvailable = funding != null

  const [session, setSession] = useState<FundingSession | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)
  // Generation guard: only the latest open()/reset() updates state, so a stale
  // poll loop can't clobber newer state after reset or unmount.
  const generation = useRef(0)
  const lastCheckout = useRef<{ url: string; redirectUrl: string } | null>(null)

  useEffect(() => {
    return () => {
      generation.current += 1
    }
  }, [])

  const reset = useCallback(() => {
    generation.current += 1
    lastCheckout.current = null
    setSession(null)
    setError(null)
    setLoading(false)
  }, [])

  const methods = useCallback<UseOnramp['methods']>(
    async (target, opts) => {
      if (!funding) throw new Error(NOT_AVAILABLE)
      return funding.methods({
        targetChain: target.chain,
        targetCurrency: target.currency,
        country: opts?.country,
        angles: RN_ANGLES,
      })
    },
    [funding]
  )

  const quote = useCallback<UseOnramp['quote']>(
    async (sessionRef, params) => {
      if (!funding) throw new Error(NOT_AVAILABLE)
      return funding.sessions.quote(sessionRef.id, {
        ...params,
        clientSecret: sessionRef.clientSecret,
        angles: RN_ANGLES,
      })
    },
    [funding]
  )

  const open = useCallback<UseOnramp['open']>(
    async (target, params) => {
      generation.current += 1
      const gen = generation.current
      const isCurrent = () => generation.current === gen
      setError(null)
      setLoading(true)
      try {
        if (!funding) throw new Error(NOT_AVAILABLE)
        const redirectUrl = params.redirectUrl ?? createOAuthRedirectUri('openfort/onramp')
        const terminal = await runPopupOnramp(
          {
            funding,
            present: (url, redirect) => {
              lastCheckout.current = { url, redirectUrl: redirect }
              return openOAuthSession({ url, redirectUri: redirect })
            },
            onUpdate: (update) => {
              if (isCurrent()) {
                setSession(update)
                setLoading(false)
              }
            },
            isCurrent,
          },
          target,
          { ...params, redirectUrl }
        )
        return terminal
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        if (isCurrent()) {
          setError(err)
          setLoading(false)
        }
        throw err
      }
    },
    [funding]
  )

  const present = useCallback(() => {
    const checkout = lastCheckout.current
    if (!checkout) return
    void openOAuthSession({ url: checkout.url, redirectUri: checkout.redirectUrl }).catch(() => undefined)
  }, [])

  return {
    session,
    status: session?.status ?? 'idle',
    error,
    loading,
    isAvailable,
    methods,
    quote,
    open,
    present,
    reset,
  }
}
