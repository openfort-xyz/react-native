import { EmbeddedState, type User } from '@openfort/openfort-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const metadata = { acceptedTerms: true, termsVersion: '2026-11', consent: { marketing: false } }
const loginResponse = { token: 'session-token', user: { id: 'usr_1' } }

const client = {
  auth: {
    logInWithEmailPassword: vi.fn(async () => loginResponse),
    logInWithEmailOtp: vi.fn(async () => loginResponse),
    logInWithPhoneOtp: vi.fn(async () => loginResponse),
    loginWithSiwe: vi.fn(async () => loginResponse),
  },
  user: { get: vi.fn(async (): Promise<User> => ({ id: 'usr_1', metadata })) },
}
const context = {
  client,
  user: null as User | null,
  embeddedState: EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED,
  getAccessToken: vi.fn(),
  passwordState: { status: 'initial' },
  setPasswordState: vi.fn(),
  siweState: { status: 'idle' },
  setSiweState: vi.fn(),
  _internal: {
    refreshUserState: vi.fn(async (user?: User) => {
      context.user = user ?? (await client.user.get())
      return context.user
    }),
  },
}

vi.mock('react', () => ({ useCallback: (fn: unknown) => fn, useState: (init: unknown) => [init, () => {}] }))
vi.mock('../../core', () => ({ useOpenfortContext: () => context }))
vi.mock('../../core/context', () => ({ useOpenfortContext: () => context }))
vi.mock('../../native/oauth', () => ({ createOAuthRedirectUri: () => 'app://callback' }))

const { useUser } = await import('./useUser')
const { useEmailAuth } = await import('../auth/useEmailAuth')
const { useEmailAuthOtp } = await import('../auth/useEmailAuthOtp')
const { usePhoneAuthOtp } = await import('../auth/usePhoneAuthOtp')
const { useWalletAuth } = await import('../auth/useWalletAuth')

beforeEach(() => {
  vi.clearAllMocks()
  context.user = null
})

describe('useUser', () => {
  it.each([
    ['email and password', () => useEmailAuth().signInEmail({ email: 'a@b.co', password: 'pw' })],
    ['email OTP', () => useEmailAuthOtp().signInEmailOtp({ email: 'a@b.co', otp: '123456' })],
    ['phone OTP', () => usePhoneAuthOtp().signInPhoneOtp({ phone: '+34600000000', otp: '123456' })],
    [
      'SIWE',
      () => useWalletAuth().signInWithSiwe({ signature: '0xsig', walletAddress: '0xabc', messageOverride: 'msg' }),
    ],
  ])('returns the metadata set from the backend after %s sign-in', async (_method, signIn) => {
    const result = await signIn()

    expect(result.error).toBeUndefined()
    expect(useUser().user?.metadata).toEqual(metadata)
  })
})
