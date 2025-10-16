/**
 * Maps config keys to their corresponding .env variable names
 */
const KEY_TO_ENV_VAR: Record<string, string> = {
  publishableKey: 'OPENFORT_PUBLISHABLE_KEY',
  shieldPublishableKey: 'OPENFORT_SHIELD_PUBLISHABLE_KEY',
}

/**
 * Validates that required environment variables are present.
 *
 * @param config - Dictionary of configuration keys and their values
 * @throws Error if required environment variables are missing
 */
export function validateEnvironment(config: Record<string, string | undefined>): void {
  const missing: string[] = []

  Object.entries(config).forEach(([key, value]) => {
    if (!value) {
      const envVarName = KEY_TO_ENV_VAR[key] || key
      missing.push(envVarName)
    }
  })

  if (missing.length > 0) {
    throw new Error(`[Openfort SDK] Missing required .env variables: ${missing.join(', ')}`)
  }
}
