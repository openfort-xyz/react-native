import { useEffect, useState } from 'react'
import { isPasskeySupported } from '../../native/passkey'

/**
 * Hook to detect if the platform supports passkeys (WebAuthn).
 *
 * Note: This only checks basic passkey support, not PRF extension support.
 * PRF support can only be determined during passkey creation via the
 * `clientExtensionResults.prf.enabled` field in the response.
 *
 * @returns Object with `isSupported` boolean and `isLoading` state
 */
export function usePasskeySupport() {
  const [isSupported, setIsSupported] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    async function checkSupport() {
      try {
        const available = await isPasskeySupported()
        setIsSupported(available)
      } catch {
        setIsSupported(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkSupport()
  }, [])

  return {
    isSupported,
    isLoading,
  }
}
