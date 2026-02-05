import { type IPasskeyHandler, PasskeyUtils } from '@openfort/openfort-js'

/** Resolved API from react-native-passkeys (module.Passkeys ?? module). Library may export sync or async isSupported. */
export type PasskeysAPI = {
  create?: (options: any) => Promise<any>
  get?: (options: any) => Promise<any>
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
   */
  private extractKeyBytes(prfResultBytes: Uint8Array): string {
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

    const credential = await api.create(publicKey as any)
    if (!credential) {
      throw new Error('Could not create passkey')
    }

    const prfResults = credential.clientExtensionResults?.prf
    if (!prfResults?.results?.first) {
      throw new Error('PRF extension not supported or missing results')
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

    const challenge = PasskeyUtils.generateChallenge()
    const challengeBase64URL = PasskeyUtils.arrayBufferToBase64URL(challenge)
    // Openfort may store credential id as standard base64; react-native-passkeys expects base64url
    const credentialId =
      config.id.includes('+') || config.id.includes('/') ? PasskeyUtils.base64ToBase64URL(config.id) : config.id

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
    }

    const api = getPasskeysAPI()
    if (!api?.get || typeof api.get !== 'function') {
      throw new Error('react-native-passkeys module not available')
    }

    const assertion = await api.get(publicKey as any)
    if (!assertion) {
      throw new Error('Could not get passkey assertion')
    }

    const prfResults = assertion.clientExtensionResults?.prf
    if (!prfResults?.results?.first) {
      throw new Error('PRF extension not supported or missing results')
    }

    const prfResultBytes = this.normalizePRFResult(prfResults.results.first)
    return this.extractKeyBytes(prfResultBytes)
  }
}
