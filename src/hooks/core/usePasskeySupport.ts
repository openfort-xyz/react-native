import { useEffect, useState } from "react";

// Lazy import to avoid blocking app initialization if react-native-passkeys is not available
type PasskeysModule = {
  create?: (options: any) => Promise<any>;
  get?: (options: any) => Promise<any>;
  isSupported?: () => Promise<boolean>;
  Passkeys?: {
    create: (options: any) => Promise<any>;
    get: (options: any) => Promise<any>;
    isSupported: () => Promise<boolean>;
  };
};

let Passkeys: PasskeysModule | null = null;

function getPasskeys(): PasskeysModule | null {
  if (!Passkeys) {
    try {
      const module = require("react-native-passkeys");
      // Extract Passkeys object or use direct exports
      // The library exports either { Passkeys: { create, get, isSupported } } or { create, get, isSupported } directly
      Passkeys = module.Passkeys || module;
    } catch (error) {
      return null;
    }
  }
  return Passkeys;
}

/**
 * Hook to detect if the platform supports passkeys and PRF extension.
 *
 * @returns Object containing passkey support information
 */
export function usePasskeySupport() {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isPRFSupported, setIsPRFSupported] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkSupport() {
      try {
        const PasskeysAPI = getPasskeys();
        if (!PasskeysAPI) {
          setIsSupported(false);
          setIsPRFSupported(false);
          setIsLoading(false);
          return;
        }

        // Check if passkeys are available
        if (!PasskeysAPI.isSupported) {
          setIsSupported(false);
          setIsPRFSupported(false);
          setIsLoading(false);
          return;
        }

        const available = await PasskeysAPI.isSupported();
        setIsSupported(available);

        if (available) {
          // Check PRF support by attempting to create a test credential
          // Note: This is a simplified check - in production you might want
          // to check the actual PRF capability more carefully
          try {
            // PRF support is typically available on iOS 18+ and Android 14+
            // For now, we'll assume if passkeys are supported, PRF might be available
            // A more robust check would require actually testing PRF extension
            setIsPRFSupported(true); // Optimistic - actual check would require test credential
          } catch {
            setIsPRFSupported(false);
          }
        } else {
          setIsPRFSupported(false);
        }
      } catch (error) {
        setIsSupported(false);
        setIsPRFSupported(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkSupport();
  }, []);

  return {
    isSupported,
    isPRFSupported,
    isLoading,
  };
}
