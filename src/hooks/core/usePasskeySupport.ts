import { useEffect, useState } from 'react'
import { checkPRFSupport } from '../../native/passkey'

// Lazy import to avoid blocking app initialization if react-native-passkeys is not available
type PasskeysModule = {
  create?: (options: any) => Promise<any>
  get?: (options: any) => Promise<any>
  isSupported?: () => Promise<boolean>
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
      const module = require('react-native-passkeys')
      // Extract Passkeys object or use direct exports
      // The library exports either { Passkeys: { create, get, isSupported } } or { create, get, isSupported } directly
      Passkeys = module.Passkeys || module
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

export type UsePasskeySupportOptions = {
  /** When provided with rpName, runs a real PRF check (create test credential) and sets isPRFSupported from the result. Omit to get isPRFSupported false and call checkPRFSupport() yourself when needed. */
  rpId?: string
  /** Required with rpId for the hook to run the real PRF check. */
  rpName?: string
}

/**
 * Hook to detect if the platform supports passkeys and PRF extension.
 *
 * When options.rpId and options.rpName are provided, runs a real PRF check (same as checkPRFSupport)
 * and sets isPRFSupported from the result. When omitted, isPRFSupported is false so apps don't hit
 * DataError from an optimistic value; use checkPRFSupport({ rpId, rpName }) when you need a real check.
 *
 * @param options - Optional { rpId, rpName }. When both are set, the hook runs the real PRF check.
 * @returns Object containing passkey support information
 */
export function usePasskeySupport(options?: UsePasskeySupportOptions) {
  const [isSupported, setIsSupported] = useState<boolean>(false)
  const [isPRFSupported, setIsPRFSupported] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const rpId = options?.rpId
  const rpName = options?.rpName

  useEffect(() => {
    async function checkSupport() {
      try {
        const PasskeysAPI = getPasskeys()
        if (!PasskeysAPI) {
          setIsSupported(false)
          setIsPRFSupported(false)
          setIsLoading(false)
          return
        }

        if (!PasskeysAPI.isSupported) {
          setIsSupported(false)
          setIsPRFSupported(false)
          setIsLoading(false)
          return
        }

        const available = await PasskeysAPI.isSupported()
        setIsSupported(available)

        if (available && rpId && rpName) {
          try {
            const prfSupported = await checkPRFSupport({ rpId, rpName })
            setIsPRFSupported(prfSupported)
          } catch {
            setIsPRFSupported(false)
          }
        } else {
          setIsPRFSupported(false)
        }
      } catch {
        setIsSupported(false)
        setIsPRFSupported(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkSupport()
  }, [rpId, rpName])

  return {
    isSupported,
    isPRFSupported,
    isLoading,
  }
}
