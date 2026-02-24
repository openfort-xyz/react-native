import { useEffect, useState } from 'react'
import { isPasskeyPrfSupported } from '../../native/passkey'

/**
 * Hook to detect if the device supports passkey-based wallet recovery with the PRF extension.
 * Requires Android 14+ (API 34) or iOS 18+. On older versions or other platforms, returns
 * `isSupported: false`. Use to conditionally show passkey options in your UI.
 *
 * @returns Object with `isSupported` boolean and `isLoading` state
 */
export function usePasskeyPrfSupport() {
  const [isSupported, setIsSupported] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    async function checkSupport() {
      try {
        const available = await isPasskeyPrfSupported()
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
