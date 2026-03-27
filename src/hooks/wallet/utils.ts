import type { RecoveryParams } from '@openfort/openfort-js'
import { OpenfortError, RecoveryMethod, SignerError } from '@openfort/openfort-js'
import type { EmbeddedWalletConfiguration } from '../../core/provider'

/**
 * Resolves an encryption session from wallet configuration.
 *
 * This utility handles encryption session resolution for automatic wallet recovery.
 * It supports both callback-based session retrieval and endpoint-based session creation.
 *
 * @param walletConfig - The embedded wallet configuration from the provider
 * @param otpCode - Optional OTP code for Shield verification
 * @param userId - Optional user ID for the encryption session
 * @returns A promise that resolves to the encryption session string
 * @throws {OpenfortError} When wallet config is missing or session cannot be retrieved
 *
 * @internal
 */
async function resolveEncryptionSession(
  walletConfig?: EmbeddedWalletConfiguration,
  otpCode?: string,
  userId?: string
): Promise<string> {
  if (!walletConfig) {
    throw new SignerError('missing_encryption_session', 'Encryption session configuration is required')
  }

  // Try callback-based session retrieval first
  if (walletConfig.getEncryptionSession) {
    return await walletConfig.getEncryptionSession({ otpCode, userId })
  }

  // Try endpoint-based session creation
  if (walletConfig.createEncryptedSessionEndpoint) {
    try {
      const response = await fetch(walletConfig.createEncryptedSessionEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ otp_code: otpCode, user_id: userId }),
      })

      if (!response.ok) {
        throw new SignerError('encryption_session_error', 'Failed to create encryption session')
      }

      const body = (await response.json()) as { session?: string }
      if (!body?.session || typeof body.session !== 'string') {
        throw new SignerError(
          'encryption_session_error',
          'Encryption session response is missing the `session` property'
        )
      }

      return body.session
    } catch (error) {
      if (error instanceof OpenfortError) {
        throw error
      }
      throw new SignerError('encryption_session_error', 'Failed to create encryption session')
    }
  }

  throw new SignerError('missing_encryption_session', 'Encryption session configuration is required')
}

/**
 * Builds recovery parameters from options and wallet configuration.
 *
 * This utility constructs the appropriate RecoveryParams object based on whether
 * a recovery password is provided or automatic recovery should be used.
 *
 * @param options - Options containing optional recovery password, OTP code, and/or user ID
 * @param walletConfig - The embedded wallet configuration from the provider
 * @returns A promise that resolves to RecoveryParams for the SDK
 *
 * @internal
 */
export async function buildRecoveryParams(
  options:
    | {
        recoveryPassword?: string
        otpCode?: string
        userId?: string
        recoveryMethod?: 'automatic' | 'password' | 'passkey'
        passkeyId?: string
      }
    | undefined,
  walletConfig?: EmbeddedWalletConfiguration
): Promise<RecoveryParams> {
  // If passkey recovery method is explicitly requested
  if (options?.recoveryMethod === 'passkey') {
    // If passkeyId is provided, use it for recovery
    if (options.passkeyId) {
      return {
        recoveryMethod: RecoveryMethod.PASSKEY,
        passkeyInfo: {
          passkeyId: options.passkeyId,
        },
      }
    }
    // If no passkeyId, this is a creation request - SDK will create the passkey
    return {
      recoveryMethod: RecoveryMethod.PASSKEY,
    }
  }

  // If password recovery method is explicitly requested or password is provided
  if (options?.recoveryMethod === 'password' || options?.recoveryPassword) {
    if (!options?.recoveryPassword) {
      throw new SignerError(
        'missing_recovery_password',
        'Recovery password is required when using password recovery method'
      )
    }
    return {
      recoveryMethod: RecoveryMethod.PASSWORD,
      password: options.recoveryPassword,
    }
  }

  // Default to automatic recovery
  return {
    recoveryMethod: RecoveryMethod.AUTOMATIC,
    encryptionSession: await resolveEncryptionSession(walletConfig, options?.otpCode, options?.userId),
  }
}
