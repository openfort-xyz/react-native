import { useEffect, useState } from 'react'
import { isPasskeySupported } from '../../native/passkey'

export type UsePasskeySupportOptions = {
  /** Reserved for future use (e.g. RP config). Passkey support uses the library's isSupported() only. */
  rpId?: string
  rpName?: string
}

/**
 * Hook to detect if the platform supports passkeys (WebAuthn).
 * Uses the library's isSupported() only — no credential creation.
 *
 * @returns Object containing passkey support (isSupported, isPRFSupported set from the same check)
 */
export function usePasskeySupport(_options?: UsePasskeySupportOptions) {
  const [isSupported, setIsSupported] = useState<boolean>(false)
  const [isPRFSupported, setIsPRFSupported] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    async function checkSupport() {
      try {
        const available = await isPasskeySupported()
        setIsSupported(available)
        setIsPRFSupported(available)
      } catch {
        setIsSupported(false)
        setIsPRFSupported(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkSupport()
  }, [])

  return {
    isSupported,
    isPRFSupported,
    isLoading,
  }
}
