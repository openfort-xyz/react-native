import type { RecoveryParams } from '@openfort/openfort-js'
import { RecoveryMethod } from '@openfort/openfort-js'
import type { EmbeddedWalletConfiguration } from '../../core/provider'
import { OpenfortError, OpenfortErrorType } from '../../types/openfortError'

/**
 * Resolves an encryption session from wallet configuration.
 *
 * This utility handles encryption session resolution for automatic wallet recovery.
 * It supports both callback-based session retrieval and endpoint-based session creation.
 *
 * @param walletConfig - The embedded wallet configuration from the provider
 * @returns A promise that resolves to the encryption session string
 * @throws {OpenfortError} When wallet config is missing or session cannot be retrieved
 *
 * @internal
 */
async function resolveEncryptionSession(walletConfig?: EmbeddedWalletConfiguration): Promise<string> {
  if (!walletConfig) {
    throw new OpenfortError('Encryption session configuration is required', OpenfortErrorType.WALLET_ERROR)
  }

  // Try callback-based session retrieval first
  if (walletConfig.getEncryptionSession) {
    return await walletConfig.getEncryptionSession()
  }

  // Try endpoint-based session creation
  if (walletConfig.createEncryptedSessionEndpoint) {
    try {
      const response = await fetch(walletConfig.createEncryptedSessionEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new OpenfortError('Failed to create encryption session', OpenfortErrorType.WALLET_ERROR, {
          status: response.status,
        })
      }

      const body = (await response.json()) as { session?: string }
      if (!body?.session || typeof body.session !== 'string') {
        throw new OpenfortError(
          'Encryption session response is missing the `session` property',
          OpenfortErrorType.WALLET_ERROR
        )
      }

      return body.session
    } catch (error) {
      if (error instanceof OpenfortError) {
        throw error
      }
      throw new OpenfortError('Failed to create encryption session', OpenfortErrorType.WALLET_ERROR, { error })
    }
  }

  throw new OpenfortError('Encryption session configuration is required', OpenfortErrorType.WALLET_ERROR)
}

/**
 * Builds recovery parameters from options and wallet configuration.
 *
 * This utility constructs the appropriate RecoveryParams object based on whether
 * a recovery password is provided or automatic recovery should be used.
 *
 * @param options - Options containing optional recovery password
 * @param walletConfig - The embedded wallet configuration from the provider
 * @returns A promise that resolves to RecoveryParams for the SDK
 *
 * @internal
 */
export async function buildRecoveryParams(
  options: { recoveryPassword?: string } | undefined,
  walletConfig?: EmbeddedWalletConfiguration
): Promise<RecoveryParams> {
  if (options?.recoveryPassword) {
    return {
      recoveryMethod: RecoveryMethod.PASSWORD,
      password: options.recoveryPassword,
    }
  }

  return {
    recoveryMethod: RecoveryMethod.AUTOMATIC,
    encryptionSession: await resolveEncryptionSession(walletConfig),
  }
}
