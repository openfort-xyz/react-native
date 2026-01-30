import type { IPasskeyHandler } from '@openfort/openfort-js'

type PasskeysModule = {
  create: (options: any) => Promise<any>
  get: (options: any) => Promise<any>
  isSupported: () => Promise<boolean>
  Passkeys?: {
    create: (options: any) => Promise<any>
    get: (options: any) => Promise<any>
    isSupported: () => Promise<boolean>
  }
}

let Passkeys: PasskeysModule | null = null
let passkeysLoadAttempted = false
let passkeysLoadError: Error | null = null

function getPasskeys(): PasskeysModule | null {
  if (!Passkeys && !passkeysLoadAttempted) {
    passkeysLoadAttempted = true
    try {
      Passkeys = require('react-native-passkeys')
    } catch (error) {
      passkeysLoadError = error instanceof Error ? error : new Error(String(error))
      return null
    }
  }

  if (passkeysLoadError) {
    return null
  }

  return Passkeys
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
 * Thrown when crypto.subtle.importKey rejects the key data (e.g. React Native polyfill
 * BufferSource strictness). Callers can use prfResultBytes with getRawKeyBytes() instead.
 */
export class PasskeyBufferSourceFallbackError extends Error {
  constructor(public readonly prfResultBytes: Uint8Array) {
    super('importKey rejected key data; use raw PRF bytes fallback')
    this.name = 'PasskeyBufferSourceFallbackError'
  }
}

/**
 * NativePasskeyHandler implements IPasskeyHandler using react-native-passkeys.
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
      return new Uint8Array(buffer)
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
   * Derives a CryptoKey from PRF result. Uses a dedicated ArrayBuffer + Uint8Array for
   * importKey (Google-inspired); on BufferSource error tries Node Buffer fallback; if still
   */
  private async deriveFromPRFResult(prfResult: ArrayBuffer | Uint8Array): Promise<CryptoKey> {
    const bytes = prfResult instanceof Uint8Array ? prfResult : new Uint8Array(prfResult)
    const keyBytes = this.getRawKeyBytes(bytes)

    // Dedicated ArrayBuffer + fresh Uint8Array so polyfills get a valid BufferSource (no shared/offset view)
    const keyBuffer = new ArrayBuffer(this.derivedKeyLengthBytes)
    const keyView = new Uint8Array(keyBuffer)
    keyView.set(keyBytes.subarray(0, this.derivedKeyLengthBytes))

    const algo = { name: 'AES-CBC', length: this.derivedKeyLengthBytes * 8 }
    const usages: KeyUsage[] = ['encrypt', 'decrypt']

    try {
      return await crypto.subtle.importKey('raw', new Uint8Array(keyBuffer), algo, this.extractableKey, usages)
    } catch (e) {
      const isBufferSourceError = e instanceof TypeError && e.message?.includes('BufferSource')
      type BufferCtor = { from(arr: Uint8Array): ArrayBufferView }
      const globalBuf = (globalThis as { Buffer?: BufferCtor }).Buffer
      const BufferImpl: BufferCtor | null =
        typeof globalBuf !== 'undefined'
          ? globalBuf
          : (() => {
              try {
                return (require('buffer') as { Buffer: BufferCtor }).Buffer
              } catch {
                return null
              }
            })()
      if (isBufferSourceError && BufferImpl) {
        try {
          const keyData = BufferImpl.from(keyView) as unknown as BufferSource
          return await crypto.subtle.importKey('raw', keyData, algo, this.extractableKey, usages)
        } catch {
          // Buffer fallback also failed; throw so callers use raw bytes
        }
      }
      if (isBufferSourceError) {
        throw new PasskeyBufferSourceFallbackError(bytes)
      }
      throw e
    }
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

    const passkeysModule = getPasskeys()
    if (!passkeysModule) {
      throw new Error('react-native-passkeys module not available')
    }

    const PasskeysAPI = passkeysModule.Passkeys || passkeysModule
    if (!PasskeysAPI.create || typeof PasskeysAPI.create !== 'function') {
      throw new Error('Passkeys API create method not available')
    }
    const credential = await PasskeysAPI.create(publicKey as any)
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
      try {
        const derivedKey = await this.deriveFromPRFResult(prfResultBytes)
        if (this.extractableKey) {
          key = new Uint8Array(await crypto.subtle.exportKey('raw', derivedKey))
        }
      } catch (e) {
        if (e instanceof PasskeyBufferSourceFallbackError) {
          key = this.getRawKeyBytes(e.prfResultBytes)
        } else {
          throw e
        }
      }
    } else {
      if (this.extractableKey) {
        key = this.getRawKeyBytes(prfResultBytes)
      }
    }

    return {
      id: credential.id,
      displayName: config.displayName,
      key,
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

    const passkeysModule = getPasskeys()
    if (!passkeysModule) {
      throw new Error('react-native-passkeys is not available. Please ensure it is installed and the app is rebuilt.')
    }
    const PasskeysAPI = passkeysModule.Passkeys || passkeysModule
    if (!PasskeysAPI.get) {
      throw new Error('Passkeys API does not have get method')
    }
    const assertion = await PasskeysAPI.get(publicKey as any)
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
      try {
        const derivedKey = await this.deriveKey(config)
        return new Uint8Array(await crypto.subtle.exportKey('raw', derivedKey))
      } catch (e) {
        if (e instanceof PasskeyBufferSourceFallbackError) {
          return this.getRawKeyBytes(e.prfResultBytes)
        }
        throw e
      }
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
    const passkeysModule = getPasskeys()
    if (!passkeysModule) {
      throw new Error('react-native-passkeys is not available. Please ensure it is installed and the app is rebuilt.')
    }
    const PasskeysAPI = passkeysModule.Passkeys || passkeysModule
    if (!PasskeysAPI.get) {
      throw new Error('Passkeys API does not have get method')
    }
    const assertion = await PasskeysAPI.get(publicKey as any)
    if (!assertion) {
      throw new Error('could not get passkey assertion')
    }
    const prfResults = assertion.clientExtensionResults?.prf
    if (!prfResults || !prfResults.results?.first) {
      throw new Error('PRF extension not supported or missing results')
    }
    const prfResultBytes = this.normalizePRFResultFirst(prfResults.results.first)
    return this.getRawKeyBytes(prfResultBytes)
  }
}

function arrayBufferToBase64URL(buffer: ArrayBuffer | ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer)
  const base64 = btoa(String.fromCharCode(...bytes))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Performs a real PRF support check by creating a minimal test credential with the PRF extension.
 * Use this to gate "Create with passkey" on actual PRF availability (e.g. after assetlinks.json is configured on Android).
 *
 * @param options - Must include rpId and rpName (same values as your passkey handler config).
 * @returns true if PRF is supported and a test credential was created with prf.results.first; false otherwise. Does not throw.
 *
 * @example
 * ```ts
 * const supported = await checkPRFSupport({ rpId: 'your.domain.com', rpName: 'Openfort - Embedded Wallet' });
 * if (supported) {
 *   // Show "Create Wallet with Passkey" button
 * }
 * ```
 */
export async function checkPRFSupport(options: { rpId: string; rpName: string }): Promise<boolean> {
  const { rpId, rpName } = options
  try {
    const passkeysModule = getPasskeys()
    if (!passkeysModule) {
      return false
    }
    const PasskeysAPI = passkeysModule.Passkeys || passkeysModule
    if (typeof PasskeysAPI.create !== 'function') {
      return false
    }
    const isSupported =
      typeof PasskeysAPI.isSupported === 'function' ? await PasskeysAPI.isSupported() : PasskeysAPI.isSupported
    if (!isSupported) {
      return false
    }
    if (!rpId || !rpName) {
      return false
    }
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const challengeBase64URL = arrayBufferToBase64URL(challenge.buffer)
    const testUserId = `prf-check-${Date.now()}`
    const userIdBase64URL = arrayBufferToBase64URL(new TextEncoder().encode(testUserId).buffer)
    const testSeed = 'prf-check-seed'
    const seedBase64URL = arrayBufferToBase64URL(new TextEncoder().encode(testSeed).buffer)
    const publicKey = {
      challenge: challengeBase64URL,
      rp: { id: rpId, name: rpName },
      user: {
        id: userIdBase64URL,
        name: testUserId,
        displayName: rpName,
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
      extensions: { prf: { eval: { first: seedBase64URL } } },
      timeout: 60_000,
      attestation: 'none',
    }
    const credential = await PasskeysAPI.create(publicKey as PublicKeyCredentialCreationOptions)
    if (!credential?.clientExtensionResults?.prf?.results?.first) {
      return false
    }
    return true
  } catch {
    return false
  }
}
