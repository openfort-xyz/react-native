/**
 * Environment validation utilities used to ensure required configuration is present
 * before the Openfort provider is instantiated. This module is intentionally
 * framework-agnostic and relies on simple heuristics so it can run in both Expo
 * and vanilla React Native environments.
 */

export interface EnvironmentValidationError {
  /** Identifier for the configuration entry (typically the env var name). */
  key: string;
  /** Human readable description of what is wrong. */
  message: string;
}

export interface EnvironmentRule {
  /** Name of the environment variable (e.g. OPENFORT_PROJECT_PUBLISHABLE_KEY). */
  envName: string;
  /** Optional Expo extra key mapped to the same value. */
  extraKey?: string;
  /** Description used in error messaging. */
  description: string;
  /** Whether this value must be provided. */
  required: boolean;
  /**
   * Allow known placeholder values (e.g. README defaults). Defaults to false which
   * means placeholders are treated as missing.
   */
  allowPlaceholder?: boolean;
  /** Optional validator returning an error message when invalid. */
  validate?: (value: string) => string | null;
}

export interface EnvironmentValidationOptions {
  /**
   * Optional custom lookup that runs before the default processors. Use this to
   * hook into proprietary configuration sources.
   */
  getValue?: (rule: EnvironmentRule) => string | undefined;
}

export interface EnvironmentValidationResult {
  isValid: boolean;
  errors: EnvironmentValidationError[];
  values: Record<string, string | undefined>;
}

const PLACEHOLDER_VALUES = new Set<string>([
  'YOUR_PROJECT_PUBLISHABLE_KEY',
  'YOUR_SHIELD_PUBLISHABLE_KEY',
  'YOUR_SHIELD_ENCRYPTION_PART',
  'YOUR_GAS_SPONSORSHIP_POLICY_ID',
  'https://your-recovery-endpoint.example.com',
]);

let expoConstantsCache: Record<string, unknown> | null | undefined;

/**
 * Lazily imports Expo constants so the SDK can run in bare React Native
 * environments without bundling the expo-constants module.
 *
 * @returns Expo constants object when available.
 */
function getExpoConstants(): Record<string, unknown> | undefined {
  if (expoConstantsCache !== undefined) {
    return expoConstantsCache ?? undefined;
  }

  try {
    // Dynamic require so the SDK does not hard-require Expo at runtime.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require('expo-constants');
    const constants = module?.default ?? module;
    expoConstantsCache = constants ?? null;
    return constants ?? undefined;
  } catch (_error) {
    expoConstantsCache = null;
    return undefined;
  }
}

/**
 * Retrieves a value from the Expo manifest/extra configuration if available.
 *
 * @param key The extra key to lookup.
 * @returns The stringified value or undefined when absent.
 */
function readExpoExtra(key: string): string | undefined {
  const constants = getExpoConstants();
  if (!constants) {
    return undefined;
  }

  const expoConfig = (constants as { expoConfig?: { extra?: Record<string, unknown> } }).expoConfig;
  const manifest = (constants as { manifest?: { extra?: Record<string, unknown> } }).manifest;
  const extras = expoConfig?.extra ?? manifest?.extra;
  if (!extras) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(extras, key)) {
    return sanitizeCandidate(extras[key]);
  }
  return undefined;
}

/**
 * Reads the value for a given environment variable from process.env.
 *
 * @param key Environment variable name.
 * @returns Normalised string or undefined when not present.
 */
function readProcessEnv(key: string): string | undefined {
  if (typeof process === 'undefined') {
    return undefined;
  }

  const envValue = (process.env as Record<string, unknown> | undefined)?.[key];
  return sanitizeCandidate(envValue);
}

/**
 * Normalises arbitrary values into trimmed strings, rejecting unsupported types.
 *
 * @param candidate Raw value discovered during lookup.
 * @returns Sanitised string or undefined if unusable.
 */
function sanitizeCandidate(candidate: unknown): string | undefined {
  if (candidate === undefined || candidate === null) {
    return undefined;
  }

  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }

  if (typeof candidate === 'number' || typeof candidate === 'boolean') {
    return String(candidate);
  }

  return undefined;
}

/**
 * Determines whether a value corresponds to a known placeholder token.
 *
 * @param value Candidate configuration value.
 * @param allowPlaceholder Allow placeholders to pass validation.
 * @returns True when the value should be treated as missing.
 */
function isPlaceholder(value: string, allowPlaceholder: boolean | undefined): boolean {
  if (allowPlaceholder) {
    return false;
  }
  return PLACEHOLDER_VALUES.has(value);
}

/**
 * Resolves the best available value for a rule using custom lookups, env vars, or Expo extras.
 *
 * @param rule Rule describing how to resolve the value.
 * @param options Optional lookup hooks.
 * @returns First resolved string or undefined.
 */
function getValueForRule(
  rule: EnvironmentRule,
  options?: EnvironmentValidationOptions,
): string | undefined {
  const candidates: Array<string | undefined> = [];

  if (options?.getValue) {
    candidates.push(options.getValue(rule));
  }

  candidates.push(readProcessEnv(rule.envName));

  if (rule.extraKey) {
    candidates.push(readExpoExtra(rule.extraKey));
  }

  for (const candidate of candidates) {
    if (candidate !== undefined) {
      return candidate;
    }
  }

  return undefined;
}

/**
 * Validates configuration against a set of rules, returning missing or invalid entries.
 *
 * @param rules Validation rules for the environment.
 * @param options Optional value resolution hooks.
 * @returns Aggregate validation result with errors and resolved values.
 */
export function validateEnvironmentVariables(
  rules: EnvironmentRule[] = DEFAULT_ENV_RULES,
  options?: EnvironmentValidationOptions,
): EnvironmentValidationResult {
  const errors: EnvironmentValidationError[] = [];
  const values: Record<string, string | undefined> = {};

  for (const rule of rules) {
    const value = getValueForRule(rule, options);
    values[rule.envName] = value;

    const missing = value === undefined || isPlaceholder(value, rule.allowPlaceholder);

    if (missing) {
      if (rule.required) {
        errors.push({
          key: rule.envName,
          message: `${rule.description} is required but missing.`,
        });
      }
      continue;
    }

    if (rule.validate) {
      const validationError = rule.validate(value);
      if (validationError) {
        errors.push({
          key: rule.envName,
          message: validationError,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    values,
  };
}

/**
 * Convenience wrapper around validateEnvironmentVariables for parity with samples.
 *
 * @param rules Validation rules for the environment.
 * @param options Optional value resolution hooks.
 * @returns EnvironmentValidationResult identical to validateEnvironmentVariables.
 */
export function getEnvironmentStatus(
  rules: EnvironmentRule[] = DEFAULT_ENV_RULES,
  options?: EnvironmentValidationOptions,
): EnvironmentValidationResult {
  return validateEnvironmentVariables(rules, options);
}

export const DEFAULT_ENV_RULES: EnvironmentRule[] = [
  {
    envName: 'OPENFORT_PROJECT_PUBLISHABLE_KEY',
    extraKey: 'openfortPublishableKey',
    description: 'Openfort publishable key for initializing the client',
    required: true,
    validate: (value) =>
      value.startsWith('pk_')
        ? null
        : "Expected the publishable key to start with 'pk_'",
  },
  {
    envName: 'OPENFORT_SHIELD_PUBLISHABLE_KEY',
    extraKey: 'openfortShieldPublishableKey',
    description: 'Shield publishable key used for wallet encryption',
    required: true,
  },
];

export const SHIELD_ENV_RULES: EnvironmentRule[] = [
  {
    envName: 'OPENFORT_SHIELD_ENCRYPTION_PART',
    extraKey: 'openfortShieldEncryptionKey',
    description: 'Shield encryption part required for signing requests',
    required: true,
  },
  {
    envName: 'OPENFORT_SHIELD_RECOVERY_BASE_URL',
    extraKey: 'openfortShieldRecoveryBaseUrl',
    description: 'Wallet recovery service base URL',
    required: true,
    validate: (value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'https:'
          ? null
          : 'Wallet recovery URL must use HTTPS';
      } catch (_error) {
        return 'Wallet recovery URL must be a valid URL';
      }
    },
  },
];

export const EXTENDED_ENV_RULES: EnvironmentRule[] = [...DEFAULT_ENV_RULES, ...SHIELD_ENV_RULES];
