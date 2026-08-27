/**
 * What a line carries besides its message. Anything JSON-serialisable: the
 * fields a reader would otherwise have to reconstruct from prose — an id, a
 * duration, a model name, the provider's own answer.
 */
export type LogContext = Record<string, unknown>;

/**
 * The port every layer logs through. An abstract class rather than an
 * interface because it is also the injection token, which is the rule for
 * every port in this repository (ADR-0003).
 *
 * The message is a sentence about what happened and stays constant across
 * calls; everything that varies belongs in the context, where it can be
 * searched. `Package a3f… took 12s` is a string; `('Verification finished',
 * { packageId, durationMs })` is a record.
 */
export abstract class Logger {
  abstract log(message: string, context?: LogContext): void;
  abstract error(message: string, context?: LogContext): void;
  abstract warn(message: string, context?: LogContext): void;
  abstract debug(message: string, context?: LogContext): void;
  abstract verbose(message: string, context?: LogContext): void;

  /**
   * A logger that carries the given fields on every line it writes. What a
   * class or a request is called is said once, here, rather than repeated into
   * every call.
   */
  abstract child(context: LogContext): Logger;
}
