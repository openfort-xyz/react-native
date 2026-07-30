import { describe, expect, it } from 'vitest'
import { initialWalletPayStep, US_MOBILE_E164 } from './walletPayIdentity'

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

describe('initialWalletPayStep', () => {
  it('starts at email when the auth session has no email', () => {
    expect(initialWalletPayStep(null)).toBe('email')
    expect(initialWalletPayStep({ phoneNumber: '+14155550123', phoneNumberVerified: true })).toBe('email')
  })

  it('starts at phone when the email exists but the phone is missing or unverified', () => {
    expect(initialWalletPayStep({ email: 'a@b.co' })).toBe('phone')
    expect(initialWalletPayStep({ email: 'a@b.co', phoneNumber: '+14155550123', phoneNumberVerified: false })).toBe(
      'phone'
    )
  })

  it('is already complete when auth collected and verified both', () => {
    expect(initialWalletPayStep({ email: 'a@b.co', phoneNumber: '+14155550123', phoneNumberVerified: true })).toBe(
      'complete'
    )
  })
})
