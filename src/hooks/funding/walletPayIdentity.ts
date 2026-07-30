/**
 * Pure pieces of the wallet-pay verification flow — kept free of client/native
 * imports so they are unit-testable and reusable outside the hook.
 */

/** Where the verification flow currently is; the host renders one screen per step. */
export type WalletPayVerificationStep = 'email' | 'emailCode' | 'phone' | 'phoneCode' | 'complete'

/** US mobile in E.164 — mirrors the api's guard on native wallet-pay orders. */
export const US_MOBILE_E164 = /^\+1[2-9]\d{9}$/

/** The minimal slice of the auth user the step derivation reads. */
export type WalletPayUser = {
  email?: string | null
  phoneNumber?: string | null
  phoneNumberVerified?: boolean
} | null

/**
 * First verification step for a user: skip whatever the auth session already
 * collected. Email present → no email step; phone present AND verified → no
 * phone step (its `phoneNumberVerifiedAt` is stamped at completion).
 */
export function initialWalletPayStep(user: WalletPayUser): WalletPayVerificationStep {
  if (!user?.email) return 'email'
  if (!user.phoneNumber || !user.phoneNumberVerified) return 'phone'
  return 'complete'
}
