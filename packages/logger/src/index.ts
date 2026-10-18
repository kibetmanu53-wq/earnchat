export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function stringifyValue(value: unknown): string {
  if (value instanceof Error) return value.stack ?? value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  return value;
}

function formatPretty(level: LogLevel, message: string, fields: Record<string, unknown>): string {
  const time = new Date().toISOString();
  const extras = Object.entries(fields)
    .map(([key, value]) => `${key}=${stringifyValue(value)}`)
    .join(' ');
  return `[${time}] ${level.toUpperCase()} ${message}${extras ? ` ${extras}` : ''}`;
}

/**
 * Structured logger: single-line JSON in production, human-readable lines
 * otherwise. Level is controlled by LOG_LEVEL (default "info"); set LOG_PRETTY=1
 * to force the readable format.
 */
export function createLogger(base: Record<string, unknown> = {}, env: NodeJS.ProcessEnv = process.env): Logger {
  const threshold = LEVELS[(env.LOG_LEVEL ?? 'info') as LogLevel] ?? LEVELS.info;
  const pretty = env.LOG_PRETTY === '1' || (env.NODE_ENV ?? 'development') !== 'production';

  function emit(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    if (LEVELS[level] < threshold) return;
    const merged = { ...base, ...fields };
    const line = pretty
      ? formatPretty(level, message, merged)
      : JSON.stringify({ time: new Date().toISOString(), level, msg: message, ...merged }, jsonReplacer);
    if (level === 'warn' || level === 'error') console.error(line);
    else console.log(line);
  }

  return {
    debug: (message, fields) => emit('debug', message, fields),
    info: (message, fields) => emit('info', message, fields),
    warn: (message, fields) => emit('warn', message, fields),
    error: (message, fields) => emit('error', message, fields),
    child: (fields) => createLogger({ ...base, ...fields }, env)
  };
}

export const logger = createLogger();
