import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}))

vi.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: '17.0' },
}))

// The logger pulls in @openfort/openfort-js for a display helper; stub it so
// the test doesn't need the full SDK module graph.
vi.mock('../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import * as SecureStore from 'expo-secure-store'
import { handleSecureStorageMessage, isSecureStorageMessage } from './storage'

const getMessage = { event: 'app:secure-storage:get', id: 'op-1', data: { key: 'origin:share' } }

describe('handleSecureStorageMessage get', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the stored value', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue('stored')

    const response = await handleSecureStorageMessage(getMessage)

    expect(response.data).toEqual({ value: 'stored' })
  })

  it('returns null without an error field when the value is absent', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null)

    const response = await handleSecureStorageMessage(getMessage)

    expect(response.data).toEqual({ value: null })
    expect(response.data.error).toBeUndefined()
  })

  it('reports read failures explicitly instead of returning a bare null', async () => {
    // A failed read (e.g. secure storage not available yet) must be
    // distinguishable from "no value stored" on the receiving side.
    vi.mocked(SecureStore.getItemAsync).mockRejectedValue(new Error('storage unavailable'))

    const response = await handleSecureStorageMessage(getMessage)

    expect(response.data.value).toBeNull()
    expect(response.data.error).toBe('secure-storage-read-failed')
  })

  it('normalizes colons in keys for SecureStore compatibility', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null)

    await handleSecureStorageMessage(getMessage)

    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('origin-share', expect.anything())
  })
})

describe('handleSecureStorageMessage set/remove', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports success on write', async () => {
    vi.mocked(SecureStore.setItemAsync).mockResolvedValue()

    const response = await handleSecureStorageMessage({
      event: 'app:secure-storage:set',
      id: 'op-2',
      data: { key: 'origin:share', value: 'v' },
    })

    expect(response.data).toEqual({ success: true })
  })

  it('reports failure on write errors', async () => {
    vi.mocked(SecureStore.setItemAsync).mockRejectedValue(new Error('boom'))

    const response = await handleSecureStorageMessage({
      event: 'app:secure-storage:set',
      id: 'op-3',
      data: { key: 'origin:share', value: 'v' },
    })

    expect(response.data).toEqual({ success: false })
  })

  it('reports success on remove', async () => {
    vi.mocked(SecureStore.deleteItemAsync).mockResolvedValue()

    const response = await handleSecureStorageMessage({
      event: 'app:secure-storage:remove',
      id: 'op-4',
      data: { key: 'origin:share' },
    })

    expect(response.data).toEqual({ success: true })
  })
})

describe('isSecureStorageMessage', () => {
  it('accepts well-formed storage messages', () => {
    expect(isSecureStorageMessage(getMessage)).toBe(true)
  })

  it('rejects penpal and other messages', () => {
    expect(isSecureStorageMessage({ namespace: 'penpal', type: 'SYN' })).toBe(false)
    expect(isSecureStorageMessage({ event: 'other:event', id: '1', data: {} })).toBe(false)
    expect(isSecureStorageMessage(null)).toBe(false)
    expect(isSecureStorageMessage('string')).toBe(false)
  })
})
