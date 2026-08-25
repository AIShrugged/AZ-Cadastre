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
      ? { err: { stack: context } }
      : { context: { scope: context } };
  }

  if (!context || typeof context !== 'object') return {};

  const fields: Record<string, unknown> = {};
  let raised: Error | undefined;

  for (const [key, value] of Object.entries(context as LogContext)) {
    if (!(value instanceof Error)) {
      fields[key] = value;
      continue;
    }

    // The first Error goes to the top level as `err`, which is the key pino
    // serialises and the pretty printer expands into readable frames. A stack
    // rendered as a JSON string with `\n` in it is a stack nobody reads.
    if (!raised) {
      raised = value;
      continue;
    }

    // Errors are not JSON-serialisable — message and stack are non-enumerable
    // — and pino's serializer only applies to the top level.
    fields[key] = describe(value);
  }

  return {
    ...(raised ? { err: raised } : {}),
    ...(Object.keys(fields).length > 0 ? { context: fields } : {}),
  };
}

function describe(error: Error): Record<string, unknown> {
  return { name: error.name, message: error.message, stack: error.stack };
}

function isStack(value: string): boolean {
  return value.includes('\n    at ') || value.includes('\n  at ');
}
