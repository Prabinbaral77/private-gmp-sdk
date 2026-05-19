export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

export type Logger = {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(scope: string): Logger;
};

export type LoggerOptions = {
  level?: LogLevel;
  scope?: string;
  /** Sink. Default writes to `console`. Override to integrate pino/winston/etc. */
  sink?: (level: LogLevel, line: string, meta?: Record<string, unknown>) => void;
};

const defaultSink = (
  level: LogLevel,
  line: string,
  meta?: Record<string, unknown>,
): void => {
  const fn =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  if (meta && Object.keys(meta).length > 0) {
    fn(line, meta);
  } else {
    fn(line);
  }
};

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? (process.env['LOG_LEVEL'] as LogLevel | undefined) ?? 'info';
  const sink = options.sink ?? defaultSink;
  const scope = options.scope ?? 'aleo-sdk';

  const threshold = LEVELS[level] ?? LEVELS.info;

  const log = (lvl: LogLevel, message: string, meta?: Record<string, unknown>): void => {
    if (LEVELS[lvl] < threshold) {
      return;
    }
    const line = `[${new Date().toISOString()}] [${lvl.toUpperCase()}] [${scope}] ${message}`;
    sink(lvl, line, meta);
  };

  return {
    debug: (m, meta) => log('debug', m, meta),
    info: (m, meta) => log('info', m, meta),
    warn: (m, meta) => log('warn', m, meta),
    error: (m, meta) => log('error', m, meta),
    child: (childScope) =>
      createLogger({ ...options, level, sink, scope: `${scope}:${childScope}` }),
  };
}
