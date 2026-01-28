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
 * NativePasskeyHandler implements IPasskeyHandler using react-native-passkeys
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
   * Converts ArrayBuffer to base64url (URL-safe base64) as required by WebAuthn spec
   */
  private arrayBufferToBase64URL(buffer: ArrayBuffer | ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer)
    const base64 = btoa(String.fromCharCode(...bytes))
    // Convert to base64url: replace + with -, / with _, and remove padding =
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  /**
   * Converts ArrayBuffer to regular base64 (for PRF seed - must be base64, not base64url)
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer)
    return btoa(String.fromCharCode(...bytes))
  }

  private async deriveFromPRFResult(prfResult: ArrayBuffer): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'raw',
      prfResult,
      { name: 'AES-CBC', length: this.derivedKeyLengthBytes * 8 },
      this.extractableKey,
      ['encrypt', 'decrypt']
    )
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
      // Iteration 17: Use MINIMAL authenticatorSelection like Safe.global tutorial
      // Safe.global uses ONLY requireResidentKey: true (no other fields)
      // This matches their working implementation from https://github.com/5afe/react-native-passkeys-tutorial
      authenticatorSelection: {
        requireResidentKey: true, // Only field used by Safe.global tutorial
      },
      // Iteration 14: Add excludeCredentials explicitly - Android might require this parameter even if empty
      excludeCredentials: [], // Empty array for new passkey creation
      // PRF extension required for key derivation (encryption key for wallet shares)
      extensions: {
        prf: {
          eval: {
            // PRF seed must be base64 (not base64url) as per Android Credentials API requirements
            first: this.arrayBufferToBase64(new TextEncoder().encode(config.seed).buffer),
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

    try {
      const credential = await PasskeysAPI.create(publicKey as any)
      if (!credential) {
        throw new Error('could not create passkey')
      }

      const prfResults = credential.clientExtensionResults?.prf
      if (!prfResults || !prfResults.results?.first) {
        throw new Error('PRF extension not supported or missing results')
      }

      const prfResultBuffer = this.base64ToArrayBuffer(prfResults.results.first)
      const derivedKey = await this.deriveFromPRFResult(prfResultBuffer)

      let key: Uint8Array | undefined
      if (this.extractableKey) {
        key = new Uint8Array(await crypto.subtle.exportKey('raw', derivedKey))
      }

      return {
        id: credential.id,
        displayName: config.displayName,
        key,
      }
    } catch (error) {
      throw error
    }
  }

  async deriveKey(config: { id: string; seed: string }): Promise<CryptoKey> {
    if (!this.rpId) {
      throw new Error('rpId must be configured')
    }

    const challenge = this.getChallengeBytes()
    // Android Credentials API requires base64url for challenge
    const challengeBase64URL = this.arrayBufferToBase64URL(challenge.buffer)
    const credentialIdBuffer = this.base64ToArrayBuffer(config.id)

    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge: challengeBase64URL, // base64url for Android
      rpId: this.rpId,
      allowCredentials: [
        {
          // credentialId is received from native module as base64, keep as base64
          id: this.arrayBufferToBase64(credentialIdBuffer),
          type: 'public-key',
        },
      ],
      userVerification: 'required',
      extensions: {
        prf: {
          eval: {
            // PRF seed must be base64 (not base64url) as per Android Credentials API requirements
            first: this.arrayBufferToBase64(new TextEncoder().encode(config.seed).buffer),
          },
        },
      },
    }

    const passkeysModule = getPasskeys()
    if (!passkeysModule) {
      throw new Error('react-native-passkeys is not available. Please ensure it is installed and the app is rebuilt.')
    }
    // Extract Passkeys object or use direct exports
    // The library exports either { Passkeys: { create, get, isSupported } } or { create, get, isSupported } directly
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

    const prfResultBuffer = this.base64ToArrayBuffer(prfResults.results.first)
    return this.deriveFromPRFResult(prfResultBuffer)
  }

  async deriveAndExportKey(config: { id: string; seed: string }): Promise<Uint8Array> {
    if (!this.extractableKey) {
      throw new Error('Derived keys cannot be exported if extractableKey is not set to true')
    }
    const derivedKey = await this.deriveKey(config)
    return new Uint8Array(await crypto.subtle.exportKey('raw', derivedKey))
  }
}
