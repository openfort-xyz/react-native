import type {
  FundingApi,
  FundingPaymentMethodInput,
  FundingSession,
  FundingSessionStatus,
  FundingTarget,
  PayLinkParams,
} from '@openfort/openfort-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOpenfortClient } from '../core/useOpenfortClient'

/**
 * Funding session hook for React Native.
 *
 * A session is one deposit attempt against a destination: create a session, set
 * one payment method (a source the user commits to sending from), then poll
 * until the session reaches a terminal state. The resolved payment method
 * carries everything a custom UI (or an agent) needs — a receiver address, a
 * scannable URI, prefilled wallet deeplinks, and CEX guidance.
 *
 * This is a thin wrapper over the openfort-js `funding` namespace
 * (`client.funding`). The namespace handles auth (publishable key) and the API
 * base URL, so the hook needs no extra configuration.
 */

// Re-export the funding types consumers need to call this hook, so they can be
// imported from `@openfort/react-native` alongside `useFunding`.
export type {
  FundingCexGuidance,
  FundingFee,
  FundingPaymentMethod,
  FundingPaymentMethodInput,
  FundingSession,
  FundingSessionStatus,
  FundingSource,
  FundingTarget,
  FundingWalletDeeplink,
  PayLinkParams,
} from '@openfort/openfort-js'

export type UseFunding = {
  session: FundingSession | null
  status: FundingSessionStatus | 'idle'
  error: Error | null
  /** True while a session is being created and its deposit address fetched. */
  loading: boolean
  /** True when the openfort-js funding namespace is available on the client. */
  isAvailable: boolean
  /** Create a session, set a payment method, and poll until terminal. */
  fund: (target: FundingTarget, paymentMethod: FundingPaymentMethodInput) => Promise<FundingSession>
  /** Create a bare session for a target (no payment method, no polling) — used to mint a pay-link. */
  createSession: (target: FundingTarget) => Promise<FundingSession>
  /** Poll an already-created session (id + clientSecret) until it reaches a terminal state. */
  track: (session: { id: string; clientSecret: string }) => Promise<FundingSession>
  /** Resolve a hosted Coinbase pay URL for an existing session. */
  payLink: (params: PayLinkParams) => Promise<string>
  /** Reset to the idle state. */
  reset: () => void
}

const TERMINAL: FundingSessionStatus[] = ['succeeded', 'bounced', 'expired']
const POLL_MS = 4000

/** The one funding capability the poll loop needs — lets useOnramp reuse it. */
export type FundingSessionReader = {
  sessions: { get(id: string, params: { clientSecret: string }): Promise<FundingSession> }
}

/** Poll a session until terminal, pushing each update through `onUpdate`. */
export async function pollUntilTerminal(
  funding: FundingSessionReader,
  onUpdate: (session: FundingSession) => void,
  start: FundingSession,
  isCurrent: () => boolean
): Promise<FundingSession> {
  let current = start
  while (!TERMINAL.includes(current.status)) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    if (!isCurrent()) return current
    current = await funding.sessions.get(current.id, { clientSecret: current.clientSecret })
    if (!isCurrent()) return current
    onUpdate(current)
  }
  return current
}

const NOT_AVAILABLE =
  'Funding is unavailable: the Openfort client is not initialized yet. Await waitForInitialization() before using funding.'

/**
 * Hook for the cross-chain funding (deposit) flow.
 *
 * @returns Session state plus `fund` (run the deposit flow), `createSession`,
 * `track`, `payLink`, and `reset`.
 *
 * @example
 * ```tsx
 * const { fund, session, status, loading } = useFunding();
 *
 * await fund(
 *   { chain: 'eip155:8453', currency: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', address },
 *   { type: 'evm', source: { chain: 'eip155:137', currency: '0x3c49…3359', amount: '10000000' } },
 * );
 * // render session.paymentMethod.receiverAddress / addressUri (QR) / deeplinks
 * ```
 */
export function useFunding(): UseFunding {
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

  const [session, setSession] = useState<FundingSession | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)
  // Generation guard: only the latest fund()/track()/reset() updates state, so a
  // stale poll loop can't clobber newer state after reset or unmount.
  const generation = useRef(0)

  // Stop any in-flight poll loop on unmount.
  useEffect(() => {
    return () => {
      generation.current += 1
    }
  }, [])

  const reset = useCallback(() => {
    generation.current += 1
    setSession(null)
    setError(null)
    setLoading(false)
  }, [])

  const fund = useCallback(
    async (target: FundingTarget, paymentMethod: FundingPaymentMethodInput): Promise<FundingSession> => {
      generation.current += 1
      const gen = generation.current
      const isCurrent = () => generation.current === gen
      setError(null)
      setLoading(true)
      try {
        if (!funding) throw new Error(NOT_AVAILABLE)
        const created = await funding.sessions.create({ target })
        const current = await funding.sessions.setPaymentMethod(created.id, {
          clientSecret: created.clientSecret,
          paymentMethod,
        })
        if (!isCurrent()) return current
        setSession(current)
        setLoading(false)
        return await pollUntilTerminal(funding, setSession, current, isCurrent)
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

  const createSession = useCallback(
    async (target: FundingTarget): Promise<FundingSession> => {
      if (!funding) throw new Error(NOT_AVAILABLE)
      return funding.sessions.create({ target })
    },
    [funding]
  )

  const track = useCallback(
    async (toTrack: { id: string; clientSecret: string }): Promise<FundingSession> => {
      if (!funding) throw new Error(NOT_AVAILABLE)
      generation.current += 1
      const gen = generation.current
      const isCurrent = () => generation.current === gen
      setError(null)
      try {
        const start = await funding.sessions.get(toTrack.id, { clientSecret: toTrack.clientSecret })
        if (!isCurrent()) return start
        setSession(start)
        return await pollUntilTerminal(funding, setSession, start, isCurrent)
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        if (isCurrent()) setError(err)
        throw err
      }
    },
    [funding]
  )

  const payLink = useCallback(
    async (params: PayLinkParams): Promise<string> => {
      if (!funding) throw new Error(NOT_AVAILABLE)
      return funding.payLink(params)
    },
    [funding]
  )

  return {
    session,
    status: session?.status ?? 'idle',
    error,
    loading,
    isAvailable,
    fund,
    createSession,
    track,
    payLink,
    reset,
  }
}
