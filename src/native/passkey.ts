import type { IPasskeyHandler } from '@openfort/openfort-js'

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
  timeoutMillis?: number
  derivedKeyLengthBytes?: number
  extractableKey?: boolean
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
  excludeCredentials?: Array<{ id: string; type: string }> // Iteration 14: Android might require this explicitly
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
  private readonly iValidByteLengths: number[] = [16, 24, 32]
  private readonly rpId?: string
  private readonly rpName?: string
  private readonly timeoutMillis: number
  private readonly derivedKeyLengthBytes: number
  private readonly extractableKey: boolean

  constructor(config: NativePasskeyHandlerConfig) {
    this.rpId = config.rpId
    this.rpName = config.rpName
    this.timeoutMillis = config.timeoutMillis ?? 60_000
    this.derivedKeyLengthBytes = config.derivedKeyLengthBytes ?? 32
    this.extractableKey = config.extractableKey ?? true

    if (!this.iValidByteLengths.includes(this.derivedKeyLengthBytes)) {
      throw new Error(`Invalid key byte length ${this.derivedKeyLengthBytes}`)
    }
  }

  private getChallengeBytes(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(32)) as Uint8Array
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Handle both base64 and base64url (WebAuthn uses base64url)
    const base64url = base64.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64url)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  /**
   * Normalizes prf.results.first from the native module to Uint8Array.
   * On Android, the bridge may return base64 string or array of numbers; crypto.subtle.importKey
   * requires a BufferSource (e.g. Uint8Array) and some React Native polyfills reject plain ArrayBuffer.
   */
  private normalizePRFResultFirst(first: unknown): Uint8Array {
    if (typeof first === 'string') {
      const buffer = this.base64ToArrayBuffer(first)
      const out = new Uint8Array(buffer)
      return out
    }
    if (first instanceof ArrayBuffer) {
      const out = new Uint8Array(first)
      return out
    }
    if (ArrayBuffer.isView(first)) {
      const out = new Uint8Array(first.buffer, first.byteOffset, first.byteLength)
      return out
    }
    if (Array.isArray(first) || (typeof first === 'object' && first !== null && 'length' in first)) {
      const out = new Uint8Array(first as ArrayLike<number>)
      return out
    }
    throw new Error('PRF result first: expected base64 string, ArrayBuffer, TypedArray, or array of numbers')
  }

  /**
   * Converts ArrayBuffer to base64url (URL-safe base64) as required by WebAuthn spec
   */
  private arrayBufferToBase64URL(buffer: ArrayBuffer | ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer)
    const base64 = btoa(String.fromCharCode(...bytes))
    // Convert to base64url: replace + with -, / with _, and remove padding =
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  /**
   * Converts standard base64 to base64url (for credential id from openfort when passed to react-native-passkeys)
   */
  private base64ToBase64URL(base64: string): string {
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  /**
   * Returns true when Web Crypto subtle API is available (e.g. browser).
   * In React Native, crypto.subtle is typically undefined.
   */
  private hasSubtle(): boolean {
    return typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle !== 'undefined'
  }

  /**
   * Produces raw key bytes from PRF result when crypto.subtle is unavailable (React Native).
   * Truncates to derivedKeyLengthBytes or pads with zeros if shorter.
   */
  private getRawKeyBytes(prfResult: ArrayBuffer | Uint8Array): Uint8Array {
    const bytes = prfResult instanceof Uint8Array ? prfResult : new Uint8Array(prfResult)
    if (bytes.length >= this.derivedKeyLengthBytes) {
      return bytes.slice(0, this.derivedKeyLengthBytes)
    }
    const key = new Uint8Array(this.derivedKeyLengthBytes)
    key.set(bytes)
    return key
  }

  /**
   * Derives a CryptoKey from PRF result (from normalizePRFResultFirst). Key data is a standalone Uint8Array
   * accepted by crypto.subtle.importKey.
   */
  private async deriveFromPRFResult(prfResult: Uint8Array): Promise<CryptoKey> {
    const keyBytes = this.getRawKeyBytes(prfResult)
    const keyData = new Uint8Array(this.derivedKeyLengthBytes)
    keyData.set(keyBytes.subarray(0, this.derivedKeyLengthBytes))
    const algo = { name: 'AES-CBC', length: this.derivedKeyLengthBytes * 8 }
    const usages: KeyUsage[] = ['encrypt', 'decrypt']
    return crypto.subtle.importKey('raw', keyData, algo, this.extractableKey, usages)
  }

  async createPasskey(config: {
    id: string
    displayName: string
    seed: string
  }): Promise<{ id: string; displayName?: string; key?: Uint8Array }> {
    if (!this.rpId || !this.rpName) {
      throw new Error('rpId and rpName must be configured')
    }

    const challenge = this.getChallengeBytes()
    // Android Credentials API requires base64url for challenge
    const challengeBase64URL = this.arrayBufferToBase64URL(challenge.buffer)
    const userIdBytes = new TextEncoder().encode(config.id)
    // Android Credentials API requires base64url for user.id
    const userIdBase64URL = this.arrayBufferToBase64URL(userIdBytes.buffer)

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge: challengeBase64URL, // base64url for Android
      rp: { id: this.rpId, name: this.rpName },
      user: {
        id: userIdBase64URL, // base64url for Android
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
      excludeCredentials: [], // Empty array for new passkey creation
      // PRF extension: react-native-passkeys expects all inputs as base64url (challenge, user.id, prf.eval.first)
      extensions: {
        prf: {
          eval: {
            first: this.arrayBufferToBase64URL(new TextEncoder().encode(config.seed).buffer),
          },
        },
      },
      timeout: this.timeoutMillis,
      attestation: 'none', // Iteration 13: Using "none" per Android docs examples
    }

    const api = getPasskeysAPI()
    if (!api?.create || typeof api.create !== 'function') {
      throw new Error('react-native-passkeys module not available or create not available')
    }
    const credential = await api.create(publicKey as any)
    if (!credential) {
      throw new Error('could not create passkey')
    }

    const prfResults = credential.clientExtensionResults?.prf
    if (!prfResults || !prfResults.results?.first) {
      throw new Error('PRF extension not supported or missing results')
    }

    const prfResultBytes = this.normalizePRFResultFirst(prfResults.results.first)

    let key: Uint8Array | undefined
    if (this.hasSubtle()) {
      const derivedKey = await this.deriveFromPRFResult(prfResultBytes)
      if (this.extractableKey) {
        key = new Uint8Array(await crypto.subtle.exportKey('raw', derivedKey))
      }
    } else {
      if (this.extractableKey) {
        key = this.getRawKeyBytes(prfResultBytes)
      }
    }
    // RN→WebView uses JSON.stringify. Return plain array cast to Uint8Array for interface; JSON sends [n,n,...].
    // Shield (iframe) must convert received key to Uint8Array before crypto.subtle.importKey (e.g. new Uint8Array(key)).
    return {
      id: credential.id,
      displayName: config.displayName,
      key: key != null ? new Uint8Array(key) : undefined,
    }
  }

  async deriveKey(config: { id: string; seed: string }): Promise<CryptoKey> {
    if (!this.rpId) {
      throw new Error('rpId must be configured')
    }

    const challenge = this.getChallengeBytes()
    const challengeBase64URL = this.arrayBufferToBase64URL(challenge.buffer)
    // openfort may store credential id as standard base64; react-native-passkeys expects base64url
    const credentialId =
      config.id.includes('+') || config.id.includes('/') ? this.base64ToBase64URL(config.id) : config.id

    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge: challengeBase64URL,
      rpId: this.rpId,
      allowCredentials: [{ id: credentialId, type: 'public-key' }],
      userVerification: 'required',
      extensions: {
        prf: {
          eval: {
            first: this.arrayBufferToBase64URL(new TextEncoder().encode(config.seed).buffer),
          },
        },
      },
    }

    const api = getPasskeysAPI()
    if (!api?.get || typeof api.get !== 'function') {
      throw new Error('react-native-passkeys is not available. Please ensure it is installed and the app is rebuilt.')
    }
    const assertion = await api.get(publicKey as any)
    if (!assertion) {
      throw new Error('could not get passkey assertion')
    }

    const prfResults = assertion.clientExtensionResults?.prf
    if (!prfResults || !prfResults.results?.first) {
      throw new Error('PRF extension not supported or missing results')
    }

    const prfResultBytes = this.normalizePRFResultFirst(prfResults.results.first)
    if (this.hasSubtle()) {
      return this.deriveFromPRFResult(prfResultBytes)
    }
    throw new Error('deriveKey (CryptoKey) is not supported in React Native; passkey recovery uses deriveAndExportKey.')
  }

  async deriveAndExportKey(config: { id: string; seed: string }): Promise<Uint8Array> {
    if (!this.extractableKey) {
      throw new Error('Derived keys cannot be exported if extractableKey is not set to true')
    }
    if (this.hasSubtle()) {
      const derivedKey = await this.deriveKey(config)
      const key = new Uint8Array(await crypto.subtle.exportKey('raw', derivedKey))
      // Return as plain array so it survives JSON when sent to the Shield iframe (RN→WebView).
      return Array.from(key) as unknown as Uint8Array
    }
    // React Native path: get assertion and use raw PRF bytes (same flow as deriveKey up to buffer)
    if (!this.rpId) {
      throw new Error('rpId must be configured')
    }
    const challenge = this.getChallengeBytes()
    const challengeBase64URL = this.arrayBufferToBase64URL(challenge.buffer)
    const credentialId =
      config.id.includes('+') || config.id.includes('/') ? this.base64ToBase64URL(config.id) : config.id
    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge: challengeBase64URL,
      rpId: this.rpId,
      allowCredentials: [{ id: credentialId, type: 'public-key' }],
      userVerification: 'required',
      extensions: {
        prf: {
          eval: {
            first: this.arrayBufferToBase64URL(new TextEncoder().encode(config.seed).buffer),
          },
        },
      },
    }
    const api = getPasskeysAPI()
    if (!api?.get || typeof api.get !== 'function') {
      throw new Error('react-native-passkeys is not available. Please ensure it is installed and the app is rebuilt.')
    }
    const assertion = await api.get(publicKey as any)
    if (!assertion) {
      throw new Error('could not get passkey assertion')
    }
    const prfResults = assertion.clientExtensionResults?.prf
    if (!prfResults || !prfResults.results?.first) {
      throw new Error('PRF extension not supported or missing results')
    }
    const prfResultBytes = this.normalizePRFResultFirst(prfResults.results.first)
    const key = this.getRawKeyBytes(prfResultBytes)
    // Return as plain array so it survives JSON when sent to the Shield iframe (RN→WebView).
    return new Uint8Array(key)
  }
}
