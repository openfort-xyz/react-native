import { Openfort as OpenfortClient, type OpenfortSDKConfiguration } from '@openfort/openfort-js'
import { applicationId } from 'expo-application'
import { digest } from 'expo-crypto'
import { logger } from '../lib/logger'
import { createNormalizedStorage, SecureStorageAdapter } from './storage'

/**
 * Creates an {@link OpenfortClient} configured for Expo and React Native environments.
 *
 * The helper ensures Expo-specific utilities like secure storage and the crypto digest
 * implementation are wired into the underlying Openfort SDK.
 *
 * @param options - {@link OpenfortSDKConfiguration} containing the base configuration,
 * overrides, and optional Shield configuration.
 * @returns A fully configured {@link OpenfortClient} instance ready for React Native apps.
 *
 * @example
 * ```ts
 * const client = createOpenfortClient({
 *   baseConfiguration: new OpenfortConfiguration({ publishableKey }),
 *   overrides: { logLevel: 'debug' },
 *   shieldConfiguration: new ShieldConfiguration({ shieldPublishableKey })
 * });
 *
 * const accessToken = await client.getAccessToken();
 * ```
 */
export function createOpenfortClient({
  baseConfiguration,
  overrides,
  shieldConfiguration,
}: OpenfortSDKConfiguration): OpenfortClient {
  const nativeAppId = getNativeApplicationId()
  logger.info('Creating Openfort client with native app ID', nativeAppId)
  // appId,
  // clientId,
  // supportedChains,
  // storage: createNormalizedStorage(storage),
  // sdkVersion: `expo:${SDK_INFO.version}`,
  // nativeAppIdentifier: nativeAppId,
  // crypto: {
  //   digest,
  // },
  // baseUrl,
  // logLevel,
  return new OpenfortClient({
    baseConfiguration: {
      nativeAppIdentifier: nativeAppId,
      ...baseConfiguration,
    },
    overrides: {
      ...overrides,
      crypto: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        digest: digest as any,
      },
      storage: createNormalizedStorage(baseConfiguration.publishableKey, SecureStorageAdapter),
    },
    shieldConfiguration,
  })
}

/**
 * Resolves the native application identifier from the Expo runtime.
 *
 * @returns The native bundle identifier reported by Expo.
 * @throws {Error} Thrown when the identifier cannot be determined, typically because the
 * `expo-application` package is not installed or the native bundle identifier is missing.
 */
function getNativeApplicationId(): string {
  if (typeof applicationId !== 'string') {
    throw new Error(
      'Cannot determine native application ID. Please make sure `expo-application` is installed as a dependency and that `ios.bundleId` or `android.package` is set.'
    )
  }
  return applicationId
}

/**
 * Default {@link OpenfortClient} instance used when an application does not supply its own.
 *
 * Applications should generally manage their own instance via {@link createOpenfortClient}
 * instead of relying on this singleton.
 */
let defaultClient: OpenfortClient | null = null

/**
 * Retrieves the lazily initialised default {@link OpenfortClient} instance.
 *
 * @param options - Optional configuration used to create the client when it does not yet exist.
 * @returns The cached {@link OpenfortClient} instance.
 * @throws {Error} When the client has not been initialised and no configuration was provided.
 * @internal
 */
export function getDefaultClient(options?: OpenfortSDKConfiguration): OpenfortClient {
  if (!defaultClient && options) {
    defaultClient = createOpenfortClient(options)
  }

  if (!defaultClient) {
    throw new Error('Openfort client not initialized. Make sure to wrap your app with OpenfortProvider.')
  }

  return defaultClient
}

/**
 * Overrides the global default {@link OpenfortClient} instance that will be returned by
 * {@link getDefaultClient}.
 *
 * @param client - The client instance to set as the default.
 * @internal
 */
export function setDefaultClient(client: OpenfortClient): void {
  defaultClient = client
}
