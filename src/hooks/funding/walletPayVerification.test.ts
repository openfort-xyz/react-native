import { describe, expect, it } from 'vitest'
import {
  isTestPublishableKey,
  isValidWalletPayPhone,
  parseStoredVerifications,
  SANDBOX_E164,
  storedVerificationId,
  US_MOBILE_E164,
  withStoredVerification,
} from './walletPayIdentity'

describe('US_MOBILE_E164', () => {
  it('accepts a US mobile in E.164', () => {
    expect(US_MOBILE_E164.test('+14155550123')).toBe(true)
    expect(US_MOBILE_E164.test('+16285551234')).toBe(true)
  })

  it('rejects non-US, malformed, and non-E.164 numbers', () => {
    expect(US_MOBILE_E164.test('+447700900123')).toBe(false) // UK
    expect(US_MOBILE_E164.test('+11155550123')).toBe(false) // area code can't start with 1
    expect(US_MOBILE_E164.test('4155550123')).toBe(false) // missing +1
    expect(US_MOBILE_E164.test('+1415555012')).toBe(false) // too short
    expect(US_MOBILE_E164.test('+1 415 555 0123')).toBe(false) // spaces
  })
})

describe('isValidWalletPayPhone', () => {
  it('accepts Coinbase sandbox numbers only in test mode', () => {
    expect(SANDBOX_E164.test('+10005550100')).toBe(true)
    expect(isValidWalletPayPhone('+10005550100', true)).toBe(true)
    expect(isValidWalletPayPhone('+10005550100', false)).toBe(false)
    expect(isValidWalletPayPhone('+14155550123', false)).toBe(true)
  })
})

describe('isTestPublishableKey', () => {
  it('recognises pk_test_ keys', () => {
    expect(isTestPublishableKey('pk_test_abc')).toBe(true)
    expect(isTestPublishableKey('pk_live_abc')).toBe(false)
    expect(isTestPublishableKey(undefined)).toBe(false)
  })
})

describe('60-day verification store', () => {
  const now = Date.parse('2026-08-21T00:00:00Z')

  it('parses missing or corrupt storage as empty', () => {
    expect(parseStoredVerifications(null)).toEqual({})
    expect(parseStoredVerifications('not json')).toEqual({})
    expect(parseStoredVerifications('"a string"')).toEqual({})
  })

  it('returns a stored id only for the same destination while unexpired', () => {
    const store = withStoredVerification({}, 'sms', {
      destination: '+14155550123',
      verificationId: 'ver_1',
      verificationExpiresAt: '2026-10-20T00:00:00Z',
    })
    expect(storedVerificationId(store, 'sms', '+14155550123', now)).toBe('ver_1')
    expect(storedVerificationId(store, 'sms', '+14155550124', now)).toBeNull()
    expect(storedVerificationId(store, 'email', '+14155550123', now)).toBeNull()
    expect(storedVerificationId(store, 'sms', '+14155550123', Date.parse('2026-10-20T00:00:00Z'))).toBeNull()
  })

  it('treats a record without an expiry as valid and round-trips through JSON', () => {
    const store = withStoredVerification({}, 'email', { destination: 'a@b.co', verificationId: 'ver_2' })
    const reparsed = parseStoredVerifications(JSON.stringify(store))
    expect(storedVerificationId(reparsed, 'email', 'a@b.co', now)).toBe('ver_2')
  })

  it('replaces the previous record for the same channel', () => {
    const first = withStoredVerification({}, 'sms', { destination: '+14155550123', verificationId: 'ver_1' })
    const second = withStoredVerification(first, 'sms', { destination: '+14155550124', verificationId: 'ver_3' })
    expect(storedVerificationId(second, 'sms', '+14155550123', now)).toBeNull()
    expect(storedVerificationId(second, 'sms', '+14155550124', now)).toBe('ver_3')
  })
})
