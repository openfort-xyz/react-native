import { useCallback, useMemo, useState } from 'react'
import { useOpenfortClient } from '../core/useOpenfortClient'
import { useUser } from '../core/useUser'
import { initialWalletPayStep, US_MOBILE_E164, type WalletPayVerificationStep } from './walletPayIdentity'

export type { WalletPayUser, WalletPayVerificationStep } from './walletPayIdentity'
export { initialWalletPayStep, US_MOBILE_E164 } from './walletPayIdentity'

/**
 * The OTP-verified buyer identity a Coinbase native wallet-pay (Apple/Google
 * Pay) order requires. The app — not Coinbase — owns verification: Coinbase's
 * headless onramp mandates that the partner verifies email and phone ownership
 * (and re-verifies the phone at least every 60 days) before creating an order.
 */
export type WalletPayIdentity = {
  email: string
  /** E.164, US mobile — Coinbase guest checkout requires a real US cell. */
  phoneNumber: string
  /** ISO-8601 instant the phone OTP succeeded. */
  phoneNumberVerifiedAt: string
  /** ISO-8601 instant the user accepted Coinbase's Guest Checkout terms. */
  agreementAcceptedAt: string
}

export type UseWalletPayVerificationOptions = {
  /**
   * ISO-8601 instant the user accepted Coinbase's Guest Checkout terms —
   * stamp it when they tick the consent checkbox (Coinbase requires acceptance
   * before an order; the api rejects stamps older than 24h). Until it's
   * provided, `identity` stays null even after both verifications pass.
   */
  agreementAcceptedAt?: string | null
}

export type UseWalletPayVerification = {
  step: WalletPayVerificationStep
  /** True while an OTP request or verification is in flight. */
  loading: boolean
  error: Error | null
  /** The complete order-ready identity — non-null once verified AND consented. */
  identity: WalletPayIdentity | null
  /** Validate + send the email OTP; advances to 'emailCode'. */
  submitEmail: (email: string) => Promise<void>
  /** Verify the email OTP; advances to 'phone' (or 'complete' when the phone is already verified). */
  verifyEmailCode: (otp: string) => Promise<void>
  /** Validate (US E.164) + send the SMS OTP; advances to 'phoneCode'. */
  submitPhone: (phoneNumber: string) => Promise<void>
  /** Verify the SMS OTP (links the phone to the account); advances to 'complete'. */
  verifyPhoneCode: (otp: string) => Promise<void>
  /** Restart from the first missing piece of the current user's identity. */
  reset: () => void
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Headless email + US-phone OTP verification for Coinbase native wallet pay
 * (Apple/Google Pay), using Openfort's own auth OTP. The host app renders the
 * screens; this hook owns the state machine and produces the identity the
 * funding commit needs (`setPaymentMethod({ type: 'onramp', method:
 * 'apple_pay', ...identity })`).
 *
 * Pieces already collected by auth are skipped: a user who signed in with
 * email and has a verified phone starts at 'complete'.
 *
 * @example
 * ```tsx
 * const [consentAt, setConsentAt] = useState<string | null>(null);
 * const v = useWalletPayVerification({ agreementAcceptedAt: consentAt });
 *
 * // render per v.step: email input → OTP input → phone input → OTP input
 * // consent checkbox: onValueChange={() => setConsentAt(new Date().toISOString())}
 * // when v.identity is set, commit the onramp payment method with it and
 * // mount <OnrampPaymentSheet url={session.paymentMethod.url} />
 * ```
 */
export function useWalletPayVerification(options: UseWalletPayVerificationOptions = {}): UseWalletPayVerification {
  const client = useOpenfortClient()
  const { user } = useUser()

  const [step, setStep] = useState<WalletPayVerificationStep>(() => initialWalletPayStep(user))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [email, setEmail] = useState<string>(user?.email ?? '')
  const [phone, setPhone] = useState<string>(user?.phoneNumber ?? '')
  // Stamped the instant the phone OTP succeeds. When the phone was already
  // verified through auth, it's stamped at completion instead — the server
  // stores no verification timestamp, so "now" is the only honest value.
  const [verifiedAt, setVerifiedAt] = useState<string | null>(step === 'complete' ? new Date().toISOString() : null)

  const run = useCallback(async (work: () => Promise<void>) => {
    setLoading(true)
    setError(null)
    try {
      await work()
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [])

  const submitEmail = useCallback(
    async (nextEmail: string) => {
      const trimmed = nextEmail.trim()
      if (!EMAIL_SHAPE.test(trimmed)) {
        setError(new Error('Enter a valid email address.'))
        return
      }
      await run(async () => {
        await client.auth.requestEmailOtp({ email: trimmed })
        setEmail(trimmed)
        setStep('emailCode')
      })
    },
    [client, run]
  )

  const verifyEmailCode = useCallback(
    async (otp: string) => {
      await run(async () => {
        await client.auth.verifyEmailOtp({ email, otp })
        if (user?.phoneNumber && user.phoneNumberVerified) {
          setPhone(user.phoneNumber)
          setVerifiedAt(new Date().toISOString())
          setStep('complete')
        } else {
          setStep('phone')
        }
      })
    },
    [client, run, email, user]
  )

  const submitPhone = useCallback(
    async (nextPhone: string) => {
      const trimmed = nextPhone.trim()
      if (!US_MOBILE_E164.test(trimmed)) {
        setError(new Error('Enter a US mobile number, e.g. +14155550123.'))
        return
      }
      await run(async () => {
        await client.auth.requestPhoneOtp({ phoneNumber: trimmed })
        setPhone(trimmed)
        setStep('phoneCode')
      })
    },
    [client, run]
  )

  const verifyPhoneCode = useCallback(
    async (otp: string) => {
      await run(async () => {
        // The buyer is already authenticated (they're funding their wallet), so
        // this LINKS + verifies the phone on their account rather than logging in.
        await client.auth.linkPhoneOtp({ phoneNumber: phone, otp })
        setVerifiedAt(new Date().toISOString())
        setStep('complete')
      })
    },
    [client, run, phone]
  )

  const reset = useCallback(() => {
    setError(null)
    setLoading(false)
    setEmail(user?.email ?? '')
    setPhone(user?.phoneNumber ?? '')
    const initial = initialWalletPayStep(user)
    setVerifiedAt(initial === 'complete' ? new Date().toISOString() : null)
    setStep(initial)
  }, [user])

  const identity = useMemo<WalletPayIdentity | null>(() => {
    if (step !== 'complete' || !verifiedAt || !options.agreementAcceptedAt) return null
    const finalEmail = email || user?.email
    const finalPhone = phone || user?.phoneNumber
    if (!finalEmail || !finalPhone) return null
    return {
      email: finalEmail,
      phoneNumber: finalPhone,
      phoneNumberVerifiedAt: verifiedAt,
      agreementAcceptedAt: options.agreementAcceptedAt,
    }
  }, [step, verifiedAt, options.agreementAcceptedAt, email, phone, user])

  return { step, loading, error, identity, submitEmail, verifyEmailCode, submitPhone, verifyPhoneCode, reset }
}
