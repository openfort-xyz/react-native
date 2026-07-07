import { describe, expect, it } from 'vitest'
import {
  createCrashBackoff,
  createPendingCallTracker,
  createReloadThrottle,
  getPenpalCallId,
  getPenpalReplyId,
  getRetryDelayMs,
  INITIAL_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  WATCHDOG_RELOAD_MAX_INTERVAL_MS,
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

  it('escalates the interval while reloads fire back-to-back', () => {
    // A permanently broken page (bad deploy, network partition) must not be
    // reloaded at a constant cadence forever.
    let now = 0
    const shouldReload = createReloadThrottle(10_000, () => now, 40_000)

    expect(shouldReload()).toBe(true) // fresh start: base 10s interval
    now = 5_000
    expect(shouldReload()).toBe(false)
    now = 10_000
    expect(shouldReload()).toBe(true) // back-to-back: escalates to 20s
    now = 25_000
    expect(shouldReload()).toBe(false) // 15s elapsed < 20s
    now = 30_000
    expect(shouldReload()).toBe(true) // escalates to 40s (cap)
    now = 60_000
    expect(shouldReload()).toBe(false) // 30s elapsed < 40s
    now = 70_000
    expect(shouldReload()).toBe(true) // holds at the 40s cap
  })

  it('resets the escalation after a long quiet period', () => {
    let now = 0
    const shouldReload = createReloadThrottle(10_000, () => now, WATCHDOG_RELOAD_MAX_INTERVAL_MS)

    expect(shouldReload()).toBe(true) // base 10s
    now = 10_000
    expect(shouldReload()).toBe(true) // escalates to 20s
    now = 30_000
    expect(shouldReload()).toBe(true) // escalates to 40s
    // A quiet stretch (>= 4x the current interval) means the last reload
    // recovered — the throttle returns to the base interval.
    now = 30_000 + 40_000 * 4
    expect(shouldReload()).toBe(true)
    now += 10_000
    expect(shouldReload()).toBe(true) // back to the 10s base interval
  })
})

describe('createCrashBackoff', () => {
  it('reloads immediately on the first crash', () => {
    const nextDelay = createCrashBackoff(60_000, () => 0)
    expect(nextDelay()).toBe(0)
  })

  it('backs off on rapid consecutive crashes', () => {
    let now = 0
    const nextDelay = createCrashBackoff(60_000, () => now)

    expect(nextDelay()).toBe(0)
    now = 1_000
    expect(nextDelay()).toBe(INITIAL_RETRY_DELAY_MS)
    now = 2_000
    expect(nextDelay()).toBe(INITIAL_RETRY_DELAY_MS * 2)
    now = 3_000
    expect(nextDelay()).toBe(INITIAL_RETRY_DELAY_MS * 4)
  })

  it('caps the backoff at the max retry delay', () => {
    let now = 0
    const nextDelay = createCrashBackoff(60_000, () => now)
    for (let i = 0; i < 10; i++) {
      now += 1_000
      nextDelay()
    }
    now += 1_000
    expect(nextDelay()).toBe(MAX_RETRY_DELAY_MS)
  })

  it('treats crashes separated by a quiet period as unrelated', () => {
    let now = 0
    const nextDelay = createCrashBackoff(60_000, () => now)

    expect(nextDelay()).toBe(0)
    now = 1_000
    expect(nextDelay()).toBe(INITIAL_RETRY_DELAY_MS)
    // More than the reset window since the last crash: fresh start.
    now = 1_000 + 60_001
    expect(nextDelay()).toBe(0)
  })
})

describe('createPendingCallTracker', () => {
  it('reports pending calls between start and settle', () => {
    const tracker = createPendingCallTracker(150_000, () => 0)

    expect(tracker.hasPendingCalls()).toBe(false)
    tracker.callStarted('call-1')
    expect(tracker.hasPendingCalls()).toBe(true)
    tracker.callSettled('call-1')
    expect(tracker.hasPendingCalls()).toBe(false)
  })

  it('expires abandoned entries so a lost reply cannot suppress health checks forever', () => {
    let now = 0
    const tracker = createPendingCallTracker(150_000, () => now)

    tracker.callStarted('call-1')
    now = 150_000
    expect(tracker.hasPendingCalls()).toBe(true)
    now = 150_001
    expect(tracker.hasPendingCalls()).toBe(false)
  })

  it('clear() drops everything', () => {
    const tracker = createPendingCallTracker(150_000, () => 0)
    tracker.callStarted('a')
    tracker.callStarted('b')
    tracker.clear()
    expect(tracker.hasPendingCalls()).toBe(false)
  })
})

describe('penpal message id extraction', () => {
  it('recognizes deprecated-format calls and replies (the RN wire format)', () => {
    expect(getPenpalCallId({ penpal: 'call', id: 42, methodName: 'sign', args: [] })).toBe(42)
    expect(getPenpalReplyId({ penpal: 'reply', id: 42, resolution: 'fulfilled', returnValue: {} })).toBe(42)
  })

  it('recognizes modern-format calls and replies', () => {
    expect(getPenpalCallId({ namespace: 'penpal', type: 'CALL', id: 'uuid-1', methodPath: ['sign'] })).toBe('uuid-1')
    expect(getPenpalReplyId({ namespace: 'penpal', type: 'REPLY', callId: 'uuid-1' })).toBe('uuid-1')
  })

  it('returns null for handshake, storage, and malformed messages', () => {
    expect(getPenpalCallId({ penpal: 'syn' })).toBeNull()
    expect(getPenpalCallId({ event: 'app:secure-storage:get', id: 'op-1' })).toBeNull()
    expect(getPenpalCallId(null)).toBeNull()
    expect(getPenpalCallId('string')).toBeNull()
    expect(getPenpalReplyId({ penpal: 'synAck' })).toBeNull()
    expect(getPenpalReplyId(undefined)).toBeNull()
  })
})
