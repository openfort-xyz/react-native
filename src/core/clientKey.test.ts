import { describe, expect, it } from 'vitest'
import { computeClientConfigKey } from './clientKey'

const baseInputs = {
  publishableKey: 'pk_test_1',
  walletConfig: {
    shieldPublishableKey: 'shield_pk_1',
    recoveryMethod: 'automatic' as const,
    getEncryptionSession: async () => 'session-a',
  },
}

describe('computeClientConfigKey', () => {
  it('is stable across re-renders that pass new inline objects with the same contents', () => {
    const first = computeClientConfigKey({
      ...baseInputs,
      walletConfig: { ...baseInputs.walletConfig },
    })
    const second = computeClientConfigKey({
      ...baseInputs,
      walletConfig: { ...baseInputs.walletConfig },
    })

    expect(first).toBe(second)
  })

  it('ignores function identity changes (inline callbacks must not rebuild the client)', () => {
    const first = computeClientConfigKey({
      ...baseInputs,
      walletConfig: { ...baseInputs.walletConfig, getEncryptionSession: async () => 'session-a' },
    })
    const second = computeClientConfigKey({
      ...baseInputs,
      walletConfig: { ...baseInputs.walletConfig, getEncryptionSession: async () => 'session-b' },
    })

    expect(first).toBe(second)
  })

  it('changes when the publishable key changes', () => {
    const first = computeClientConfigKey(baseInputs)
    const second = computeClientConfigKey({ ...baseInputs, publishableKey: 'pk_test_2' })

    expect(first).not.toBe(second)
  })

  it('changes when a serializable wallet setting changes', () => {
    const first = computeClientConfigKey(baseInputs)
    const second = computeClientConfigKey({
      ...baseInputs,
      walletConfig: { ...baseInputs.walletConfig, recoveryMethod: 'password' as const },
    })

    expect(first).not.toBe(second)
  })

  it('distinguishes configured wallet from no wallet', () => {
    const first = computeClientConfigKey(baseInputs)
    const second = computeClientConfigKey({ publishableKey: baseInputs.publishableKey })

    expect(first).not.toBe(second)
  })
})
