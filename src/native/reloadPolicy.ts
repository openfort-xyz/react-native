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
  now: () => number = () => Date.now()
): () => boolean {
  let lastReloadAt = Number.NEGATIVE_INFINITY
  return () => {
    const current = now()
    if (current - lastReloadAt < minIntervalMs) {
      return false
    }
    lastReloadAt = current
    return true
  }
}
