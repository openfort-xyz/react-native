import { Openfort as OpenfortClient, OpenfortSDKConfiguration } from '@openfort/openfort-js';
import { digest } from 'expo-crypto';
import { applicationId } from 'expo-application';
import { SecureStorageAdapter, createNormalizedStorage } from './storage';


/**
 * Creates an instance of the Openfort client configured for Expo/React Native
 *
 * @param options Configuration options for the Openfort client
 * @returns Configured Openfort client instance
 *
 * @example
 * const client = createOpenfortClient({
 * });
 *
 * const token = await client.getAccessToken();
 */
export function createOpenfortClient({
  baseConfiguration,
  overrides,
  shieldConfiguration,
}: OpenfortSDKConfiguration): OpenfortClient {
  const nativeAppId = getNativeApplicationId();
  console.log('Creating Openfort client with native app ID:', nativeAppId);
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
    baseConfiguration,
    overrides: {
      ...overrides,
      crypto: {
        digest: digest as any,
      },
      storage: createNormalizedStorage(SecureStorageAdapter)
    },
    shieldConfiguration
  });
}

/**
 * Gets the native application identifier from Expo
 * Throws an error if the identifier cannot be determined
 */
function getNativeApplicationId(): string {
  if (typeof applicationId !== 'string') {
    throw new Error(
      'Cannot determine native application ID. Please make sure `expo-application` is installed as a dependency and that `ios.bundleId` or `android.package` is set.'
    );
  }
  return applicationId;
}

/**
 * Default Openfort client instance - should only be used internally
 * Applications should create their own client instances using createOpenfortClient
 */
let defaultClient: OpenfortClient | null = null;

/**
 * Gets or creates the default Openfort client instance
 * @internal
 */
export function getDefaultClient(options?: OpenfortSDKConfiguration): OpenfortClient {
  if (!defaultClient && options) {
    defaultClient = new OpenfortClient(options);
  }

  if (!defaultClient) {
    throw new Error('Openfort client not initialized. Make sure to wrap your app with OpenfortProvider.');
  }

  return defaultClient;
}

/**
 * Sets the default Openfort client instance
 * @internal
 */
export function setDefaultClient(client: OpenfortClient): void {
  defaultClient = client;
}