/**
 * Reload policy for the embedded wallet WebView.
 *
 * The WebView can stop working for reasons outside the app's control: the OS
 * reclaims the renderer process, the page fails to load on a flaky network,
 * or the wallet page becomes unresponsive after the app spends time in the
 * background. Reloading the WebView restores the communication channel; these
 * helpers decide when and how often to do that.
 */

/** Delay before the first reload after a page load error. */
export const INITIAL_RETRY_DELAY_MS = 2_000

/** Upper bound for the load-error retry backoff. */
export const MAX_RETRY_DELAY_MS = 30_000

/** Minimum spacing between health-check triggered reloads. */
export const WATCHDOG_RELOAD_MIN_INTERVAL_MS = 10_000

/**
 * Upper bound for the watchdog throttle's escalating interval. A page that
 * never recovers (bad wallet-page deploy, long network partition) must not be
 * hammered at a constant cadence forever.
 */
export const WATCHDOG_RELOAD_MAX_INTERVAL_MS = 5 * 60_000

/**
 * Window after which consecutive renderer crashes are treated as unrelated.
 */
export const CRASH_RESET_WINDOW_MS = 60_000

/**
 * Age past which a tracked in-flight call is considered abandoned. Slightly
 * above the SDK's longest per-call RPC timeout (120s), so entries whose
 * settle message was lost can never suppress health checks indefinitely.
 */
export const PENDING_CALL_MAX_AGE_MS = 150_000

/**
 * Exponential backoff for load-error retries: 2s, 4s, 8s, ... capped at
 * {@link MAX_RETRY_DELAY_MS}.
 *
 * @param attempt - 1-based count of consecutive load failures.
 * @returns Delay in milliseconds before the next reload.
 */
export function getRetryDelayMs(attempt: number): number {
  const exponent = Math.max(0, attempt - 1)
  return Math.min(INITIAL_RETRY_DELAY_MS * 2 ** exponent, MAX_RETRY_DELAY_MS)
}

/**
 * Creates a throttle for health-check reloads so repeated triggers (e.g.
 * several foreground transitions in a row while the page is already
 * reloading) don't stack reloads.
 *
 * @param minIntervalMs - Minimum time between allowed reloads.
 * @param now - Clock, injectable for tests.
 * @returns Function that reports whether a reload is allowed right now and,
 * if so, records it.
 */
export function createReloadThrottle(
  minIntervalMs: number = WATCHDOG_RELOAD_MIN_INTERVAL_MS,
  now: () => number = () => Date.now(),
  maxIntervalMs: number = WATCHDOG_RELOAD_MAX_INTERVAL_MS
): () => boolean {
  let lastReloadAt = Number.NEGATIVE_INFINITY
  let currentIntervalMs = minIntervalMs
  return () => {
    const current = now()
    const elapsed = current - lastReloadAt
    if (elapsed < currentIntervalMs) {
      return false
    }
    // Escalate while reloads fire back-to-back (a permanently broken page
    // must not be hammered at a constant cadence forever); a long quiet
    // stretch means the last reload recovered, so reset to the base interval.
    currentIntervalMs =
      elapsed >= currentIntervalMs * 4 ? minIntervalMs : Math.min(currentIntervalMs * 2, maxIntervalMs)
    lastReloadAt = current
    return true
  }
}

/**
 * Backoff for renderer-process crashes. The first crash in a while reloads
 * immediately (the process is definitively gone and the page was healthy
 * until now), but a renderer that dies repeatedly — e.g. the page OOMs on
 * every load on a low-memory device — must not produce a tight
 * crash→reload→crash loop.
 *
 * @param resetWindowMs - Quiet period after which the crash count resets.
 * @param now - Clock, injectable for tests.
 * @returns Function that records a crash and returns the delay in
 * milliseconds to wait before reloading (0 = reload immediately).
 */
export function createCrashBackoff(
  resetWindowMs: number = CRASH_RESET_WINDOW_MS,
  now: () => number = () => Date.now()
): () => number {
  let crashCount = 0
  let lastCrashAt = Number.NEGATIVE_INFINITY
  return () => {
    const current = now()
    if (current - lastCrashAt > resetWindowMs) {
      crashCount = 0
    }
    lastCrashAt = current
    crashCount += 1
    return crashCount === 1 ? 0 : getRetryDelayMs(crashCount - 1)
  }
}

/**
 * Tracks penpal calls crossing the WebView bridge so reload triggers can tell
 * whether a wallet operation is in flight. A reload destroys the page and
 * silently abandons pending RPCs (they only settle via the SDK's own
 * timeout), so the foreground health check must not probe-and-reload while
 * the page is legitimately busy. Entries older than `maxAgeMs` are treated
 * as abandoned so a lost reply can never suppress health checks forever.
 */
export function createPendingCallTracker(
  maxAgeMs: number = PENDING_CALL_MAX_AGE_MS,
  now: () => number = () => Date.now()
) {
  const pending = new Map<string | number, number>()
  return {
    callStarted(id: string | number): void {
      pending.set(id, now())
    },
    callSettled(id: string | number): void {
      pending.delete(id)
    },
    hasPendingCalls(): boolean {
      const cutoff = now() - maxAgeMs
      for (const [id, startedAt] of pending) {
        if (startedAt < cutoff) {
          pending.delete(id)
        }
      }
      return pending.size > 0
    },
    clear(): void {
      pending.clear()
    },
  }
}

/**
 * Extracts the call id from an outgoing penpal CALL message (either the
 * deprecated wire format the React Native bridge uses or the modern one),
 * or null for anything else.
 */
export function getPenpalCallId(message: unknown): string | number | null {
  if (!message || typeof message !== 'object') return null
  const m = message as Record<string, unknown>
  if (m.penpal === 'call' && (typeof m.id === 'string' || typeof m.id === 'number')) return m.id
  if (m.namespace === 'penpal' && m.type === 'CALL' && (typeof m.id === 'string' || typeof m.id === 'number')) {
    return m.id
  }
  return null
}

/**
 * Extracts the call id an incoming penpal REPLY message settles (deprecated
 * or modern wire format), or null for anything else.
 */
export function getPenpalReplyId(message: unknown): string | number | null {
  if (!message || typeof message !== 'object') return null
  const m = message as Record<string, unknown>
  if (m.penpal === 'reply' && (typeof m.id === 'string' || typeof m.id === 'number')) return m.id
  if (
    m.namespace === 'penpal' &&
    m.type === 'REPLY' &&
    (typeof m.callId === 'string' || typeof m.callId === 'number')
  ) {
    return m.callId
  }
  return null
}
