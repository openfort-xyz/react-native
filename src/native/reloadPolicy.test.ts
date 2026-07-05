import { describe, expect, it } from 'vitest'
import {
  createReloadThrottle,
  getRetryDelayMs,
  INITIAL_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  WATCHDOG_RELOAD_MIN_INTERVAL_MS,
} from './reloadPolicy'

describe('getRetryDelayMs', () => {
  it('starts at the initial delay and doubles per attempt', () => {
    expect(getRetryDelayMs(1)).toBe(INITIAL_RETRY_DELAY_MS)
    expect(getRetryDelayMs(2)).toBe(INITIAL_RETRY_DELAY_MS * 2)
    expect(getRetryDelayMs(3)).toBe(INITIAL_RETRY_DELAY_MS * 4)
  })

  it('caps at the maximum delay', () => {
    expect(getRetryDelayMs(10)).toBe(MAX_RETRY_DELAY_MS)
    expect(getRetryDelayMs(100)).toBe(MAX_RETRY_DELAY_MS)
  })

  it('treats out-of-range attempts as the first attempt', () => {
    expect(getRetryDelayMs(0)).toBe(INITIAL_RETRY_DELAY_MS)
    expect(getRetryDelayMs(-5)).toBe(INITIAL_RETRY_DELAY_MS)
  })
})

describe('createReloadThrottle', () => {
  it('allows the first reload immediately', () => {
    const shouldReload = createReloadThrottle(WATCHDOG_RELOAD_MIN_INTERVAL_MS, () => 0)
    expect(shouldReload()).toBe(true)
  })

  it('suppresses reloads inside the minimum interval and allows them after', () => {
    let now = 0
    const shouldReload = createReloadThrottle(10_000, () => now)

    expect(shouldReload()).toBe(true)
    now = 5_000
    expect(shouldReload()).toBe(false)
    now = 10_000
    expect(shouldReload()).toBe(true)
  })

  it('does not extend the window on suppressed attempts', () => {
    let now = 0
    const shouldReload = createReloadThrottle(10_000, () => now)

    expect(shouldReload()).toBe(true)
    // Repeated suppressed attempts must not push the next allowed reload out.
    now = 9_999
    expect(shouldReload()).toBe(false)
    now = 10_000
    expect(shouldReload()).toBe(true)
  })
})
