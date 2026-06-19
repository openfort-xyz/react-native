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
 * base URL, so the hook needs no extra configuration. The namespace is accessed
 * through a cast until `@openfort/openfort-js` ships funding in its public types;
 * until the dep is bumped to that release, `isAvailable` is `false` and the hook
 * is inert.
 */

/** Where funds should land. CAIP-2 chain + token contract (or native) + wallet. */
export type FundingTarget = {
  /** CAIP-2 chain id, e.g. "eip155:8453" for Base. */
  chain: string
  /** Token contract address, or the zero address for the chain's native asset. */
  currency: string
  /** Destination wallet that receives the bridged funds. */
  address: string
}

/** The route the user commits to sending from. */
export type FundingSource = {
  /** CAIP-2 chain id the user sends from, e.g. "eip155:137". */
  chain: string
  /** Token contract the user sends, or the zero address for native. */
  currency: string
  /** Amount in the source token's smallest unit (wei, lamports, base units). */
  amount: string
}

/** Session lifecycle. */
export type SessionStatus =
  | 'requires_payment_method'
  | 'waiting_payment'
  | 'processing'
  | 'succeeded'
  | 'bounced'
  | 'expired'

export type FundingFee = {
  kind: 'gas' | 'relayerGas' | 'relayerService' | 'app'
  amount: string
  currency: string
}

/**
 * Payment-method-per-source input. `evm` and `solana` are self-custody wallet
 * sends (they get wallet deeplinks); `cex` is an exchange withdrawal (no
 * deeplink — exchanges can't be deeplinked into).
 */
export type PaymentMethodInput =
  | { type: 'evm'; source: FundingSource }
  | { type: 'solana'; source: FundingSource }
  | { type: 'cex'; cex: string; source: FundingSource }

export type PaymentMethodType = PaymentMethodInput['type']

/** A prefilled deeplink into a source wallet app (e.g. Trust Wallet). */
export type WalletDeeplink = { app: string; label: string; url: string }

/** Per-exchange guidance for the guided CEX flow. */
export type CexGuidance = {
  exchange: string
  network: string
  minWithdrawal: string | null
  requiresMemo: boolean
}

/** A resolved payment method — what the UI renders and the agent reads. */
export type PaymentMethod = {
  type: PaymentMethodType
  source: FundingSource
  /** Address the user (or their CEX/wallet) sends to. */
  receiverAddress: string
  /** BIP-21 / EIP-681 / Solana Pay URI for QR. */
  addressUri: string
  /** Prefilled deeplinks for source wallet apps, when available. */
  deeplinks: WalletDeeplink[]
  /** Guidance for the "cex" type; null otherwise. */
  cex: CexGuidance | null
  fees: FundingFee[]
  /** Minimum to send for this route (source base units), or null. */
  minAmount: string | null
}

/** A single deposit attempt. */
export type FundingSession = {
  id: string
  clientSecret: string
  target: FundingTarget
  status: SessionStatus
  amountUnits: string | null
  metadata: Record<string, string> | null
  externalId: string | null
  createdAt: number
  expiresAt: number
  paymentMethod: PaymentMethod | null
}

/**
 * Parameters for a Coinbase pay-link request. The destination (chain, currency,
 * address) is bound to the session server-side; the client only chooses how much.
 */
export type PayLinkParams = {
  /** Session the pay-link settles into — pins the destination so it can't be redirected. */
  sessionId: string
  /** Secret returned when the session was created; authorizes this pay-link. */
  clientSecret: string
  /** Amount in the destination asset's units (≈ USD for USDC). Coinbase enforces its own minimum. */
  amount: string
  /** Destination asset ticker. Optional — the backend defaults to USDC. */
  asset?: string
}

/** The subset of the openfort-js `funding` namespace this hook uses. */
type FundingNamespace = {
  sessions: {
    create: (params: { target: FundingTarget }) => Promise<FundingSession>
    setPaymentMethod: (
      sessionId: string,
      params: { paymentMethod: PaymentMethodInput; clientSecret?: string }
    ) => Promise<FundingSession>
    get: (sessionId: string, params?: { clientSecret?: string }) => Promise<FundingSession>
  }
  payLink: (params: PayLinkParams) => Promise<string>
}

export type UseFunding = {
  session: FundingSession | null
  status: SessionStatus | 'idle'
  error: Error | null
  /** True while a session is being created and its deposit address fetched. */
  loading: boolean
  /** True when the openfort-js funding namespace is available on the client. */
  isAvailable: boolean
  /** Create a session, set a payment method, and poll until terminal. */
  fund: (target: FundingTarget, paymentMethod: PaymentMethodInput) => Promise<FundingSession>
  /** Create a bare session for a target (no payment method, no polling) — used to mint a pay-link. */
  createSession: (target: FundingTarget) => Promise<FundingSession>
  /** Poll an already-created session (id + clientSecret) until it reaches a terminal state. */
  track: (session: { id: string; clientSecret: string }) => Promise<FundingSession>
  /** Resolve a hosted Coinbase pay URL for an existing session. */
  payLink: (params: PayLinkParams) => Promise<string>
  /** Reset to the idle state. */
  reset: () => void
}

const TERMINAL: SessionStatus[] = ['succeeded', 'bounced', 'expired']
const POLL_MS = 4000

/** Poll a session until terminal, pushing each update through `onUpdate`. */
async function pollUntilTerminal(
  funding: FundingNamespace,
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
  'Funding is unavailable: this @openfort/react-native build is on an @openfort/openfort-js version without the funding namespace.'

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
  const funding = useMemo(
    () => (client as unknown as { funding?: FundingNamespace }).funding ?? null,
    [client]
  )
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
    async (target: FundingTarget, paymentMethod: PaymentMethodInput): Promise<FundingSession> => {
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
        return pollUntilTerminal(funding, setSession, current, isCurrent)
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
