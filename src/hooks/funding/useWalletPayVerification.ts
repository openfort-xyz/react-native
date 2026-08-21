import type { OnrampVerificationRecord } from '@openfort/openfort-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOpenfortContext } from '../../core/context'
import { SecureStorageAdapter } from '../../core/storage'
import {
  EMAIL_SHAPE,
  isTestPublishableKey,
  isValidWalletPayPhone,
  parseStoredVerifications,
  type StoredVerifications,
  storedVerificationId,
  VERIFICATIONS_STORE_KEY,
  type WalletPayVerificationChannel,
  type WalletPayVerificationStep,
  withStoredVerification,
} from './walletPayIdentity'

export type { WalletPayVerificationChannel, WalletPayVerificationStep } from './walletPayIdentity'
export { isValidWalletPayPhone, SANDBOX_E164, US_MOBILE_E164 } from './walletPayIdentity'

/**
 * The verified buyer identity a Coinbase native wallet-pay (Apple/Google Pay)
 * order requires. Coinbase issues and checks the OTPs itself (its Verification
 * API, proxied by the Openfort api); the two record ids are what the order
 * carries, the timestamps attest when this device confirmed identity + consent.
 */
export type WalletPayIdentity = {
  email: string
  /** E.164, US mobile — Coinbase guest checkout requires a real US cell (or a `+1000…` sandbox number on test keys). */
  phoneNumber: string
  /** ISO-8601 instant the phone verification completed on this device. */
  phoneNumberVerifiedAt: string
  /** ISO-8601 instant the user accepted Coinbase's Guest Checkout terms. */
  agreementAcceptedAt: string
  /** Coinbase verification record for the phone. */
  smsVerificationId: string
  /** Coinbase verification record for the email. */
  emailVerificationId: string
}

export type UseWalletPayVerificationOptions = {
  /**
   * Whether the user has ticked Coinbase's Guest Checkout consent. Collect it
   * on the phone step (as the web widget does): `submitPhone` refuses to send
   * a code until this is true, and the acceptance is stamped at completion.
   */
  agreementAccepted?: boolean
}

export type UseWalletPayVerification = {
  step: WalletPayVerificationStep
  /** True while a verification request or OTP submit is in flight. */
  loading: boolean
  error: Error | null
  /** True on a `pk_test_` key — Coinbase sandbox numbers (`+1000…`) are accepted. */
  testMode: boolean
  /** The complete order-ready identity — non-null once both verifications passed. */
  identity: WalletPayIdentity | null
  /** Validate + send the email OTP; advances to 'emailCode' (or straight to 'phone' when a stored verification is still valid). */
  submitEmail: (email: string) => Promise<void>
  /** Submit the email OTP; advances to 'phone'. */
  verifyEmailCode: (otp: string) => Promise<void>
  /** Validate (US E.164) + send the SMS OTP; advances to 'phoneCode' (or 'complete' when a stored verification is still valid). */
  submitPhone: (phoneNumber: string) => Promise<void>
  /** Submit the SMS OTP; advances to 'complete'. */
  verifyPhoneCode: (otp: string) => Promise<void>
  /** Re-send the code for the destination the current step is verifying. */
  resend: () => Promise<void>
  /** Restart from the email step. */
  reset: () => void
}

/**
 * Headless email + US-phone OTP verification for Coinbase native wallet pay
 * (Apple/Google Pay) via `client.funding.verifications`. The host app renders
 * the screens; this hook owns the state machine and produces the identity the
 * funding commit needs (`fund(target, { type: 'onramp', method: 'apple_pay',
 * ...identity })`).
 *
 * Completed verifications are kept on-device for their ~60-day validity, so a
 * repeat buyer with a stored email + phone verification only has to consent.
 *
 * @example
 * ```tsx
 * const [consented, setConsented] = useState(false);
 * const v = useWalletPayVerification({ agreementAccepted: consented });
 *
 * // render per v.step: email input → OTP input → phone input (+ consent checkbox) → OTP input
 * // when v.identity is set, commit the onramp payment method with it and
 * // mount <OnrampPaymentSheet url={session.paymentMethod.url} />
 * ```
 */
export function useWalletPayVerification(options: UseWalletPayVerificationOptions = {}): UseWalletPayVerification {
  const { client, publishableKey, user } = useOpenfortContext()
  const testMode = isTestPublishableKey(publishableKey)

  const [step, setStep] = useState<WalletPayVerificationStep>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [email, setEmail] = useState<string>(user?.email ?? '')
  const [phone, setPhone] = useState<string>(user?.phoneNumber ?? '')
  const [pendingVerificationId, setPendingVerificationId] = useState<string | null>(null)
  const [emailVerificationId, setEmailVerificationId] = useState<string | null>(null)
  const [smsVerificationId, setSmsVerificationId] = useState<string | null>(null)
  const [completedAt, setCompletedAt] = useState<string | null>(null)
  const store = useRef<StoredVerifications>({})
  const agreementAccepted = options.agreementAccepted === true

  // Load the on-device verification records once; when the auth email already
  // has a live record, skip the email step.
  useEffect(() => {
    let cancelled = false
    SecureStorageAdapter.get(VERIFICATIONS_STORE_KEY).then((raw) => {
      if (cancelled) return
      store.current = parseStoredVerifications(raw)
      const authEmail = user?.email
      if (!authEmail) return
      const stored = storedVerificationId(store.current, 'email', authEmail, Date.now())
      if (!stored) return
      setEmailVerificationId((current) => current ?? stored)
      setStep((current) => (current === 'email' ? 'phone' : current))
    })
    return () => {
      cancelled = true
    }
  }, [user?.email])

  const persist = useCallback(
    (channel: WalletPayVerificationChannel, destination: string, record: OnrampVerificationRecord) => {
      store.current = withStoredVerification(store.current, channel, { destination, ...record })
      void SecureStorageAdapter.save(VERIFICATIONS_STORE_KEY, JSON.stringify(store.current))
    },
    []
  )

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

  const startVerification = useCallback(
    (channel: WalletPayVerificationChannel, destination: string, nextStep?: WalletPayVerificationStep) =>
      run(async () => {
        const started = await client.funding.verifications.create({ channel, destination })
        setPendingVerificationId(started.verificationId)
        if (nextStep) setStep(nextStep)
      }),
    [client, run]
  )

  const submitEmail = useCallback(
    async (nextEmail: string) => {
      const trimmed = nextEmail.trim()
      if (!EMAIL_SHAPE.test(trimmed)) {
        setError(new Error('Enter a valid email address.'))
        return
      }
      setEmail(trimmed)
      const stored = storedVerificationId(store.current, 'email', trimmed, Date.now())
      if (stored) {
        setError(null)
        setEmailVerificationId(stored)
        setStep('phone')
        return
      }
      await startVerification('email', trimmed, 'emailCode')
    },
    [startVerification]
  )

  const verifyEmailCode = useCallback(
    async (otp: string) => {
      if (!pendingVerificationId) return
      await run(async () => {
        const record = await client.funding.verifications.submit(pendingVerificationId, otp)
        persist('email', email, record)
        setEmailVerificationId(record.verificationId)
        setPendingVerificationId(null)
        setStep('phone')
      })
    },
    [client, run, persist, pendingVerificationId, email]
  )

  const complete = useCallback((verificationId: string) => {
    setSmsVerificationId(verificationId)
    setPendingVerificationId(null)
    setCompletedAt(new Date().toISOString())
    setStep('complete')
  }, [])

  const submitPhone = useCallback(
    async (nextPhone: string) => {
      const trimmed = nextPhone.trim()
      if (!isValidWalletPayPhone(trimmed, testMode)) {
        setError(
          new Error(
            testMode
              ? 'Enter a US mobile (e.g. +14155550123) or a sandbox number (e.g. +10005550100).'
              : 'Enter a US mobile number, e.g. +14155550123.'
          )
        )
        return
      }
      if (!agreementAccepted) {
        setError(new Error("Accept Coinbase's Guest Checkout terms to continue."))
        return
      }
      setPhone(trimmed)
      const stored = storedVerificationId(store.current, 'sms', trimmed, Date.now())
      if (stored) {
        setError(null)
        complete(stored)
        return
      }
      await startVerification('sms', trimmed, 'phoneCode')
    },
    [testMode, agreementAccepted, complete, startVerification]
  )

  const verifyPhoneCode = useCallback(
    async (otp: string) => {
      if (!pendingVerificationId) return
      await run(async () => {
        const record = await client.funding.verifications.submit(pendingVerificationId, otp)
        persist('sms', phone, record)
        complete(record.verificationId)
      })
    },
    [client, run, persist, complete, pendingVerificationId, phone]
  )

  const resend = useCallback(async () => {
    if (step === 'emailCode') await startVerification('email', email)
    else if (step === 'phoneCode') await startVerification('sms', phone)
  }, [step, email, phone, startVerification])

  const reset = useCallback(() => {
    setError(null)
    setLoading(false)
    setEmail(user?.email ?? '')
    setPhone(user?.phoneNumber ?? '')
    setPendingVerificationId(null)
    setEmailVerificationId(null)
    setSmsVerificationId(null)
    setCompletedAt(null)
    setStep('email')
  }, [user])

  const identity = useMemo<WalletPayIdentity | null>(() => {
    if (step !== 'complete' || !completedAt || !emailVerificationId || !smsVerificationId) return null
    return {
      email,
      phoneNumber: phone,
      phoneNumberVerifiedAt: completedAt,
      agreementAcceptedAt: completedAt,
      smsVerificationId,
      emailVerificationId,
    }
  }, [step, completedAt, emailVerificationId, smsVerificationId, email, phone])

  return {
    step,
    loading,
    error,
    testMode,
    identity,
    submitEmail,
    verifyEmailCode,
    submitPhone,
    verifyPhoneCode,
    resend,
    reset,
  }
}
