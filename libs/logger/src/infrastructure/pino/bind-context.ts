import type { LogContext } from '../../application/index.js';

/**
 * What a caller passed as "context", turned into the fields of a line.
 *
 * Our own code passes an object. Nest passes strings positionally — the
 * emitting class name after every message, and a stack before it on `error()`
 * — so a string is read by what it looks like rather than by where it sits: a
 * stack filed under "scope" is worse than no field at all.
 */
export function boundContext(context?: unknown): Record<string, unknown> {
  if (typeof context === 'string') {
    return isStack(context)
      ? { stack: context }
      : { context: { scope: context } };
  }

  if (!context || typeof context !== 'object') return {};

  // Errors are not JSON-serialisable — message and stack are non-enumerable —
  // and pino's serializer only applies at the top level.
  const entries = Object.entries(context as LogContext).map(([key, value]) =>
    value instanceof Error ? [key, describe(value)] : [key, value],
  );

  return { context: Object.fromEntries(entries) };
}

function describe(error: Error): Record<string, unknown> {
  return { name: error.name, message: error.message, stack: error.stack };
}

function isStack(value: string): boolean {
  return value.includes('\n    at ') || value.includes('\n  at ');
}
