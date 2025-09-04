// Lightweight logger with standardized prefix
// Usage: logger.info('message', optionalData)

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const PREFIX = '[OPENFORT_PROVIDER]';

let verboseMode = false;

function formatMessage(level: LogLevel, message: unknown): string {
  const text = typeof message === 'string' ? message : JSON.stringify(message);
  return `${PREFIX} ${text}`;
}

function log(level: LogLevel, message: unknown, ...optionalParams: unknown[]): void {
  // Only log debug and info messages in verbose mode
  if ((level === 'debug' || level === 'info') && !verboseMode) {
    return;
  }
  
  const formatted = formatMessage(level, message);
  switch (level) {
    case 'debug':
      // eslint-disable-next-line no-console
      console.debug(formatted, ...optionalParams);
      break;
    case 'info':
      // eslint-disable-next-line no-console
      console.log(formatted, ...optionalParams);
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(formatted, ...optionalParams);
      break;
    case 'error':
      // eslint-disable-next-line no-console
      console.error(formatted, ...optionalParams);
      break;
  }
}

export const logger = {
  debug: (message: unknown, ...optionalParams: unknown[]) => log('debug', message, ...optionalParams),
  info: (message: unknown, ...optionalParams: unknown[]) => log('info', message, ...optionalParams),
  warn: (message: unknown, ...optionalParams: unknown[]) => log('warn', message, ...optionalParams),
  error: (message: unknown, ...optionalParams: unknown[]) => log('error', message, ...optionalParams),
  setVerbose: (verbose: boolean) => {
    verboseMode = verbose;
  },
  printVerboseWarning: () => {
    log(
      'warn',
      'Verbose mode is enabled. Debug and info logs will be printed. To disable, set the "verbose" prop on OpenfortProvider to false.'
    );
  },
};

export type { LogLevel };


