type LogLevel = 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

export const logger = {
  info(message: string, context?: LogContext): void {
    writeLog('info', message, context);
  },

  warn(message: string, context?: LogContext): void {
    writeLog('warn', message, context);
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    writeLog('error', message, {
      ...context,
      error: formatError(error),
    });
  },
};

function writeLog(level: LogLevel, message: string, context?: LogContext): void {
  const line = formatLogLine(level, message, context);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

function formatLogLine(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    hour12: false,
  }).format(new Date());
  const header = `[${timestamp}] ${level.toUpperCase()} ${message}`;
  const cleanContext = context ? sanitizeContext(context) : null;

  if (!cleanContext || Object.keys(cleanContext).length === 0) {
    return header;
  }

  const details = Object.entries(cleanContext)
    .map(([key, value]) => `  - ${key}: ${formatLogValue(value)}`)
    .join('\n');

  return `${header}\n${details}`;
}

function formatLogValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.length === 0 ? '[]' : value.map(formatLogValue).join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2).replace(/\n/g, '\n    ');
  }

  return String(value);
}

function formatError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return error;
}

function sanitizeContext(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      if (key.toLowerCase().includes('token') || key.toLowerCase().includes('key')) {
        return [key, '[redacted]'];
      }

      return [key, sanitizeLogValue(value)];
    }),
  );
}

function sanitizeLogValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeLogValue);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => {
      if (key.toLowerCase().includes('token') || key.toLowerCase().includes('key')) {
        return [key, '[redacted]'];
      }

      return [key, sanitizeLogValue(nestedValue)];
    }),
  );
}
