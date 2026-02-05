import {
  type IPasskeyHandler,
  PasskeyAssertionFailedError,
  PasskeyCreationFailedError,
  PasskeyPRFNotSupportedError,
  PasskeySeedInvalidError,
  PasskeyUserCancelledError,
} from '@openfort/openfort-js'
import { logger } from '../lib/logger'

/**
 * Utility functions for passkey operations in React Native.
 * Handles base64/base64url encoding, key extraction, and challenge generation.
 */
const PasskeyUtils = {
  /** Valid byte lengths for derived keys (AES-128, AES-192, AES-256) */
  validByteLengths: [16, 24, 32],

  /**
   * Validates that the key byte length is valid for AES encryption.
   * @throws Error if length is not 16, 24, or 32
   */
  validateKeyByteLength(length: number): void {
    if (!this.validByteLengths.includes(length)) {
      throw new Error(`Invalid key byte length ${length}. Must be 16, 24, or 32.`)
    }
  },

  /**
   * Generates a random 32-byte challenge for WebAuthn operations.
   */
  generateChallenge(): Uint8Array {
    const challenge = new Uint8Array(32)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(challenge)
    } else {
      // Fallback for environments without crypto.getRandomValues
      for (let i = 0; i < 32; i++) {
        challenge[i] = Math.floor(Math.random() * 256)
      }
    }
    return challenge
  },

  /**
   * Converts ArrayBuffer or Uint8Array to base64url string.
   * Base64URL uses '-' and '_' instead of '+' and '/', and omits padding '='.
   */
  arrayBufferToBase64URL(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
    let binary = ''
    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }
    const base64 = btoa(binary)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  },

  /**
   * Converts base64url string to Uint8Array.
   */
  base64URLToUint8Array(base64url: string): Uint8Array {
    // Convert base64url to base64
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '='
    }
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  },

  /**
   * Converts standard base64 to base64url format.
   * This is idempotent - safe to call on strings already in base64url format.
   */
  base64ToBase64URL(base64: string): string {
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  },

  /**
   * Extracts the first N bytes from a PRF result for use as key material.
   */
  extractRawKeyBytes(prfResult: Uint8Array, length: number): Uint8Array {
    return prfResult.slice(0, length)
  },
}

/**
 * Result from passkey credential creation.
 */
interface PasskeyCredentialResult {
  id: string
  rawId?: string
  type: string
  clientExtensionResults?: {
    prf?: {
      results?: {
        first?: unknown // Can be string, ArrayBuffer, or number[]
      }
    }
  }
  response?: {
    attestationObject?: string
    clientDataJSON?: string
  }
}

/**
 * Result from passkey assertion (get).
 */
interface PasskeyAssertionResult {
  id: string
  type: string
  clientExtensionResults?: {
    prf?: {
      results?: {
        first?: unknown
      }
    }
  }
}

/** Resolved API from react-native-passkeys (module.Passkeys ?? module). Library may export sync or async isSupported. */
export type PasskeysAPI = {
  create?: (options: PublicKeyCredentialCreationOptions) => Promise<PasskeyCredentialResult | null>
  get?: (options: PublicKeyCredentialRequestOptions) => Promise<PasskeyAssertionResult | null>
  /** Sync on native (iOS/Android), sync on web; may be function or boolean. */
  isSupported?: (() => boolean) | (() => Promise<boolean>) | boolean
}

let passkeysModule: (PasskeysAPI & { Passkeys?: PasskeysAPI }) | null = null
let passkeysLoadAttempted = false
let passkeysLoadError: Error | null = null

/**
 * Returns the passkeys API (create, get, isSupported). Resolves module.Passkeys ?? module once.
 * Returns null if the module failed to load.
 */
function getPasskeysAPI(): PasskeysAPI | null {
  if (passkeysLoadAttempted) {
    return passkeysLoadError ? null : passkeysModule ? (passkeysModule.Passkeys ?? passkeysModule) : null
  }
  passkeysLoadAttempted = true
  try {
    passkeysModule = require('react-native-passkeys')
    return passkeysModule ? (passkeysModule.Passkeys ?? passkeysModule) : null
  } catch (error) {
    passkeysLoadError = error instanceof Error ? error : new Error(String(error))
    return null
  }
}

/**
 * Returns diagnostic information about passkey support.
 * Useful for debugging why passkeys may not be available.
 */
export function getPasskeyDiagnostics(): {
  isSupported: boolean
  loadError: Error | null
  moduleLoaded: boolean
} {
  const api = getPasskeysAPI()
  return {
    isSupported: api !== null && api.isSupported !== undefined,
    loadError: passkeysLoadError,
    moduleLoaded: passkeysLoadAttempted && passkeysLoadError === null,
  }
}

/**
 * Checks if the device supports passkeys (WebAuthn). Uses the library's isSupported() only — no credential creation.
 * Normalizes sync/async and function/boolean from react-native-passkeys.
 */
export async function isPasskeySupported(): Promise<boolean> {
  const api = getPasskeysAPI()
  if (!api || api.isSupported == null) {
    return false
  }
  const supported = api.isSupported
  if (typeof supported === 'boolean') {
    return supported
  }
  if (typeof supported === 'function') {
    const result = supported()
    return result instanceof Promise ? result : Promise.resolve(result)
  }
  return false
}

export interface NativePasskeyHandlerConfig {
  rpId?: string
  rpName?: string
  timeout?: number
  derivedKeyLengthBytes?: number
}

// Type definitions for react-native-passkeys
interface PublicKeyCredentialCreationOptions {
  challenge: string
  rp: { id: string; name: string }
  user: { id: string; name: string; displayName: string }
  pubKeyCredParams: Array<{ type: string; alg: number }>
  authenticatorSelection: {
    authenticatorAttachment?: string
    residentKey?: string
    requireResidentKey?: boolean
    userVerification?: string
  }
  excludeCredentials?: Array<{ id: string; type: string }>
  extensions?: { prf?: { eval?: { first: string } } }
  timeout?: number
  attestation?: string
}

interface PublicKeyCredentialRequestOptions {
  challenge: string
  rpId: string
  allowCredentials: Array<{ id: string; type: string }>
  userVerification: string
  extensions?: { prf?: { eval?: { first: string } } }
  timeout?: number
}

/**
 * NativePasskeyHandler implements IPasskeyHandler using react-native-passkeys (create/get)
 * as the native equivalent of navigator.credentials.create/get. Same contract as openfort-js
 * PasskeyHandler; key is returned to the SDK/Shield like on web.
 */
export class NativePasskeyHandler implements IPasskeyHandler {
  private readonly rpId?: string
  private readonly rpName?: string
  private readonly timeout: number
  private readonly derivedKeyLengthBytes: number

  constructor(config: NativePasskeyHandlerConfig) {
    this.rpId = config.rpId
    this.rpName = config.rpName
    this.timeout = config.timeout ?? 60_000
    this.derivedKeyLengthBytes = config.derivedKeyLengthBytes ?? 32

    PasskeyUtils.validateKeyByteLength(this.derivedKeyLengthBytes)
  }

  /**
   * Normalizes prf.results.first from the native module to Uint8Array.
   * On Android, the bridge may return base64 string or array of numbers.
   */
  private normalizePRFResult(first: unknown): Uint8Array {
    if (typeof first === 'string') {
      return PasskeyUtils.base64URLToUint8Array(first)
    }
    if (first instanceof ArrayBuffer) {
      return new Uint8Array(first)
    }
    if (ArrayBuffer.isView(first)) {
      return new Uint8Array(first.buffer, first.byteOffset, first.byteLength)
    }
    if (Array.isArray(first) || (typeof first === 'object' && first !== null && 'length' in first)) {
      return new Uint8Array(first as ArrayLike<number>)
    }
    throw new Error('PRF result: expected base64 string, ArrayBuffer, TypedArray, or array of numbers')
  }

  /**
   * Extracts key bytes from PRF result and returns as base64url string.
   * Validates that the PRF result has sufficient entropy for the requested key length.
   */
  private extractKeyBytes(prfResultBytes: Uint8Array): string {
    // Validate PRF result has sufficient entropy
    if (prfResultBytes.length < this.derivedKeyLengthBytes) {
      throw new Error(
        `PRF result too short: got ${prfResultBytes.length} bytes, need at least ${this.derivedKeyLengthBytes} bytes`
      )
    }
    const keyBytes = PasskeyUtils.extractRawKeyBytes(prfResultBytes, this.derivedKeyLengthBytes)
    return PasskeyUtils.arrayBufferToBase64URL(keyBytes)
  }

  /**
   * Creates a passkey and derives a key using the PRF extension.
   */
  async createPasskey(config: {
    id: string
    displayName: string
    seed: string
  }): Promise<{ id: string; displayName?: string; key?: string }> {
    if (!this.rpId || !this.rpName) {
      throw new Error('rpId and rpName must be configured')
    }

    // Validate seed is non-empty for PRF entropy
    if (!config.seed || config.seed.trim().length === 0) {
      throw new PasskeySeedInvalidError()
    }

    const challenge = PasskeyUtils.generateChallenge()
    // Android Credentials API requires base64url for challenge
    const challengeBase64URL = PasskeyUtils.arrayBufferToBase64URL(challenge)
    const userIdBytes = new TextEncoder().encode(config.id)
    // Android Credentials API requires base64url for user.id
    const userIdBase64URL = PasskeyUtils.arrayBufferToBase64URL(userIdBytes)

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge: challengeBase64URL,
      rp: { id: this.rpId, name: this.rpName },
      user: {
        id: userIdBase64URL,
        name: config.id,
        displayName: config.displayName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      excludeCredentials: [],
      // PRF extension: react-native-passkeys expects all inputs as base64url
      extensions: {
        prf: {
          eval: {
            first: PasskeyUtils.arrayBufferToBase64URL(new TextEncoder().encode(config.seed)),
          },
        },
      },
      timeout: this.timeout,
      attestation: 'none',
    }

    const api = getPasskeysAPI()
    if (!api?.create || typeof api.create !== 'function') {
      throw new Error('react-native-passkeys module not available')
    }

    let credential: PasskeyCredentialResult | null
    try {
      credential = await api.create(publicKey)
    } catch (e) {
      // Re-throw known error types
      if (e instanceof PasskeyUserCancelledError) throw e
      if (e instanceof PasskeySeedInvalidError) throw e
      throw new PasskeyCreationFailedError(
        e instanceof Error ? e.message : 'Unknown error',
        e instanceof Error ? e : undefined
      )
    }

    if (!credential) {
      // Null result typically indicates user cancellation
      throw new PasskeyUserCancelledError()
    }

    const prfResults = credential.clientExtensionResults?.prf
    if (!prfResults?.results?.first) {
      // Log warning about orphaned passkey credential
      logger.warn(
        'Passkey created but PRF extension failed. ' +
          'A passkey credential may exist on the device that cannot be used for wallet recovery. ' +
          `Credential ID: ${credential.id}`
      )
      throw new PasskeyPRFNotSupportedError()
    }

    const prfResultBytes = this.normalizePRFResult(prfResults.results.first)
    const key = this.extractKeyBytes(prfResultBytes)

    return {
      id: credential.id,
      displayName: config.displayName,
      key,
    }
  }

  /**
   * Derives and exports key material from an existing passkey as base64url string.
   */
  async deriveAndExportKey(config: { id: string; seed: string }): Promise<string> {
    if (!this.rpId) {
      throw new Error('rpId must be configured')
    }

    // Validate seed is non-empty for PRF entropy
    if (!config.seed || config.seed.trim().length === 0) {
      throw new PasskeySeedInvalidError()
    }

    const challenge = PasskeyUtils.generateChallenge()
    const challengeBase64URL = PasskeyUtils.arrayBufferToBase64URL(challenge)
    // Always normalize to base64url - this is idempotent for strings already in base64url format
    const credentialId = PasskeyUtils.base64ToBase64URL(config.id)

    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge: challengeBase64URL,
      rpId: this.rpId,
      allowCredentials: [{ id: credentialId, type: 'public-key' }],
      userVerification: 'required',
      extensions: {
        prf: {
          eval: {
            first: PasskeyUtils.arrayBufferToBase64URL(new TextEncoder().encode(config.seed)),
          },
        },
      },
      timeout: this.timeout,
    }

    const api = getPasskeysAPI()
    if (!api?.get || typeof api.get !== 'function') {
      throw new Error('react-native-passkeys module not available')
    }

    let assertion: PasskeyAssertionResult | null
    try {
      assertion = await api.get(publicKey)
    } catch (e) {
      // Re-throw known error types
      if (e instanceof PasskeyUserCancelledError) throw e
      if (e instanceof PasskeySeedInvalidError) throw e
      throw new PasskeyAssertionFailedError(
        e instanceof Error ? e.message : 'Unknown error',
        e instanceof Error ? e : undefined
      )
    }

    if (!assertion) {
      // Null result typically indicates user cancellation
      throw new PasskeyUserCancelledError()
    }

    const prfResults = assertion.clientExtensionResults?.prf
    if (!prfResults?.results?.first) {
      throw new PasskeyPRFNotSupportedError()
    }

    const prfResultBytes = this.normalizePRFResult(prfResults.results.first)
    return this.extractKeyBytes(prfResultBytes)
  }
}
