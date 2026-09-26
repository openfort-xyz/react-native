import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = {
  initSiwe: vi.fn(async () => ({ nonce: 'login-nonce' })),
  initLinkSiwe: vi.fn(async () => ({ nonce: 'link-nonce' })),
  loginWithSiwe: vi.fn(),
  linkWithSiwe: vi.fn(async () => ({ success: true, walletAddress: '0xabc' })),
}
const context = {
  client: { auth, getAccessToken: vi.fn(async (): Promise<string | null> => 'token') },
  siweState: { status: 'idle' },
  setSiweState: vi.fn(),
  _internal: { refreshUserState: vi.fn(async () => ({ id: 'usr_1' })) },
}

vi.mock('react', () => ({ useCallback: (fn: unknown) => fn }))
vi.mock('../../core/context', () => ({ useOpenfortContext: () => context }))

const { useWalletAuth } = await import('./useWalletAuth')

const from = { domain: 'example.com', uri: 'https://example.com' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useWalletAuth', () => {
  it('generateSiweMessage uses the login nonce by default', async () => {
    const { message } = await useWalletAuth().generateSiweMessage({ wallet: '0xabc', from })
    expect(auth.initSiwe).toHaveBeenCalledWith({ address: '0xabc' })
    expect(auth.initLinkSiwe).not.toHaveBeenCalled()
    expect(message).toContain('Nonce: login-nonce')
  })

  it('generateSiweMessage uses the link nonce when link is set', async () => {
    const { message } = await useWalletAuth().generateSiweMessage({ wallet: '0xabc', from, link: true })
    expect(auth.initLinkSiwe).toHaveBeenCalledWith({ address: '0xabc' })
    expect(auth.initSiwe).not.toHaveBeenCalled()
    expect(message).toContain('Nonce: link-nonce')
  })

  it('linkSiwe links the wallet instead of signing in', async () => {
    const result = await useWalletAuth().linkSiwe({
      signature: '0xsig',
      walletAddress: '0xabc',
      messageOverride: 'msg',
    })
    expect(auth.linkWithSiwe).toHaveBeenCalledWith(
      expect.objectContaining({ signature: '0xsig', message: 'msg', address: '0xabc', chainId: 1 })
    )
    expect(auth.loginWithSiwe).not.toHaveBeenCalled()
    expect(context._internal.refreshUserState).toHaveBeenCalledWith()
    expect(result.user).toEqual({ id: 'usr_1' })
  })

  it('linkSiwe fails without an authenticated user', async () => {
    context.client.getAccessToken.mockResolvedValueOnce(null)
    const result = await useWalletAuth().linkSiwe({
      signature: '0xsig',
      walletAddress: '0xabc',
      messageOverride: 'msg',
    })
    expect(auth.linkWithSiwe).not.toHaveBeenCalled()
    expect(result.error).toBeDefined()
  })

  it('linkSiwe surfaces link errors', async () => {
    auth.linkWithSiwe.mockRejectedValueOnce(new Error('invalid signature'))
    const onError = vi.fn()
    const result = await useWalletAuth().linkSiwe({
      signature: '0xsig',
      walletAddress: '0xabc',
      messageOverride: 'msg',
      onError,
    })
    expect(result.error?.message).toBe('Failed to link in with Ethereum')
    expect(onError).toHaveBeenCalled()
    expect(context.setSiweState).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'error' }))
  })
})
