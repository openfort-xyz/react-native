// Lightweight logger with standardized prefix
// Usage: logger.info('message', optionalData)

import { EmbeddedState } from '@openfort/openfort-js'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const PREFIX = '[OPENFORT_PROVIDER]'

let verboseMode = false

function formatMessage(_level: LogLevel, message: unknown): string {
  const text = typeof message === 'string' ? message : JSON.stringify(message)
  return `${PREFIX} ${text}`
}

function log(level: LogLevel, message: unknown, ..._optionalParams: unknown[]): void {
  // Only log debug and info messages in verbose mode
  if ((level === 'debug' || level === 'info') && !verboseMode) {
    return
  }

  const _formatted = formatMessage(level, message)
  switch (level) {
    case 'debug':
      break
    case 'info':
      break
    case 'warn':
      break
    case 'error':
      break
  }
}

export const logger = {
  debug: (message: unknown, ...optionalParams: unknown[]) => log('debug', message, ...optionalParams),
  info: (message: unknown, ...optionalParams: unknown[]) => log('info', message, ...optionalParams),
  warn: (message: unknown, ...optionalParams: unknown[]) => log('warn', message, ...optionalParams),
  error: (message: unknown, ...optionalParams: unknown[]) => log('error', message, ...optionalParams),
  setVerbose: (verbose: boolean) => {
    verboseMode = verbose
  },
  printVerboseWarning: () => {
    log(
      'warn',
      'Verbose mode is enabled. Debug and info logs will be printed. To disable, set the "verbose" prop on OpenfortProvider to false.'
    )
  },
}

export const getEmbeddedStateName = (state: EmbeddedState): string => {
  switch (state) {
    case EmbeddedState.NONE:
      return 'NONE'
    case EmbeddedState.UNAUTHENTICATED:
      return 'UNAUTHENTICATED'
    case EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED:
      return 'EMBEDDED_SIGNER_NOT_CONFIGURED'
    case EmbeddedState.CREATING_ACCOUNT:
      return 'CREATING_ACCOUNT'
    case EmbeddedState.READY:
      return 'READY'
    default:
      return `STATE: ${String(state)}`
  }
}
