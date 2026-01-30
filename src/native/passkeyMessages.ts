import type { NativePasskeyHandlerInterface } from './passkey'

/**
 * Shape of messages sent from the Shield iframe for passkey encrypt/decrypt (local encryption).
 */
export interface PasskeyMessage {
  event: 'app:passkey:encrypt' | 'app:passkey:decrypt'
  id: string
  data: {
    passkeyId: string
    seed?: string
    plaintext?: number[]
    ciphertext?: number[]
    iv?: number[]
  }
}

/**
 * Shape of responses returned to the WebView after processing a passkey message.
 */
export interface PasskeyResponse {
  event: string
  id: string
  data: {
    ciphertext?: number[]
    iv?: number[]
    plaintext?: number[]
    error?: string
  }
}

/**
 * Checks if the provided value is a passkey encrypt/decrypt message.
 *
 * @param message - Incoming message payload.
 * @returns `true` when the payload matches the {@link PasskeyMessage} structure.
 */
export function isPasskeyMessage(message: unknown): message is PasskeyMessage {
  if (
    typeof message !== 'object' ||
    message === null ||
    !('event' in message) ||
    typeof (message as PasskeyMessage).event !== 'string' ||
    !('id' in message) ||
    typeof (message as PasskeyMessage).id !== 'string' ||
    !('data' in message) ||
    typeof (message as PasskeyMessage).data !== 'object' ||
    (message as PasskeyMessage).data === null
  ) {
    return false
  }
  const event = (message as PasskeyMessage).event
  return event === 'app:passkey:encrypt' || event === 'app:passkey:decrypt'
}

/**
 * Handles passkey encrypt/decrypt operations initiated from WebView messages.
 * Converts number[] to/from Uint8Array and delegates to the passkey handler.
 *
 * @param message - Parsed WebView message describing the desired passkey action.
 * @param passkeyHandler - Handler with encrypt/decrypt (e.g. NativePasskeyHandler).
 * @returns The response payload that should be sent back to the WebView.
 */
export async function handlePasskeyMessage(
  message: PasskeyMessage,
  passkeyHandler: NativePasskeyHandlerInterface
): Promise<PasskeyResponse> {
  const baseResponse = { event: message.event, id: message.id, data: {} as PasskeyResponse['data'] }

  try {
    if (message.event === 'app:passkey:encrypt') {
      const { passkeyId, plaintext: plaintextArr } = message.data
      if (!passkeyId || !Array.isArray(plaintextArr)) {
        baseResponse.data.error = 'encrypt requires passkeyId and plaintext (number[])'
        return baseResponse
      }
      const plaintext = new Uint8Array(plaintextArr)
      const result = await passkeyHandler.encrypt(plaintext, passkeyId)
      baseResponse.data.ciphertext = Array.from(result.ciphertext)
      baseResponse.data.iv = Array.from(result.iv)
      return baseResponse
    }

    if (message.event === 'app:passkey:decrypt') {
      const { passkeyId, seed, ciphertext: ciphertextArr, iv: ivArr } = message.data
      if (!passkeyId || !seed || !Array.isArray(ciphertextArr) || !Array.isArray(ivArr)) {
        baseResponse.data.error =
          'decrypt requires passkeyId, seed, ciphertext (number[]), and iv (number[])'
        return baseResponse
      }
      const ciphertext = new Uint8Array(ciphertextArr)
      const iv = new Uint8Array(ivArr)
      const plaintext = await passkeyHandler.decrypt(ciphertext, iv, passkeyId, seed)
      baseResponse.data.plaintext = Array.from(plaintext)
      return baseResponse
    }

    baseResponse.data.error = `Unknown passkey event: ${message.event}`
    return baseResponse
  } catch (error) {
    baseResponse.data.error = error instanceof Error ? error.message : String(error)
    return baseResponse
  }
}
