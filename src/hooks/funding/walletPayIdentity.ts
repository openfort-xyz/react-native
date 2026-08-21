/**
 * Pure pieces of the wallet-pay verification flow — kept free of client/native
 * imports so they are unit-testable and reusable outside the hook.
 */

/** Where the verification flow currently is; the host renders one screen per step. */
export type WalletPayVerificationStep = 'email' | 'emailCode' | 'phone' | 'phoneCode' | 'complete'

export type WalletPayVerificationChannel = 'sms' | 'email'

/** US mobile in E.164 — mirrors the api's guard on native wallet-pay orders. */
export const US_MOBILE_E164 = /^\+1[2-9]\d{9}$/

/** Coinbase's sandbox verification numbers (`+1000` + 7 digits) — accepted on test keys only. */
export const SANDBOX_E164 = /^\+1000\d{7}$/

export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidWalletPayPhone(phoneNumber: string, testMode: boolean): boolean {
  return US_MOBILE_E164.test(phoneNumber) || (testMode && SANDBOX_E164.test(phoneNumber))
}

/** `pk_test_` keys run against Coinbase's sandbox rails. */
export function isTestPublishableKey(publishableKey: string | null | undefined): boolean {
  return publishableKey?.startsWith('pk_test_') ?? false
}

// ---------------------------------------------------------------------------
// 60-day reuse — a completed Coinbase verification stays valid ~60 days, so
// its id is kept per channel + destination and a repeat buyer skips the OTP.
// Same shape and key as the web widget's localStorage store.
// ---------------------------------------------------------------------------

export const VERIFICATIONS_STORE_KEY = 'openfort-onramp-verifications'

export type StoredVerification = {
  destination: string
  verificationId: string
  verificationExpiresAt?: string
}

export type StoredVerifications = Partial<Record<WalletPayVerificationChannel, StoredVerification>>

export function parseStoredVerifications(raw: string | null): StoredVerifications {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as StoredVerifications) : {}
  } catch {
    return {}
  }
}

/** An unexpired stored verification id for this exact destination, or null. */
export function storedVerificationId(
  store: StoredVerifications,
  channel: WalletPayVerificationChannel,
  destination: string,
  now: number
): string | null {
  const entry = store[channel]
  if (!entry || entry.destination !== destination) return null
  if (entry.verificationExpiresAt && Date.parse(entry.verificationExpiresAt) <= now) return null
  return entry.verificationId
}

export function withStoredVerification(
  store: StoredVerifications,
  channel: WalletPayVerificationChannel,
  entry: StoredVerification
): StoredVerifications {
  return { ...store, [channel]: entry }
}
