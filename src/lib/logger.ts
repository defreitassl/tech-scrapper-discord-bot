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
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? { context: sanitizeContext(context) } : {}),
  };

  const line = JSON.stringify(payload);

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

      return [key, value];
    }),
  );
}
