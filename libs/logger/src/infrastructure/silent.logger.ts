import { Logger, type LogContext } from '../application/index.js';

/**
 * A Logger that says nothing. For specs, which construct their subject by hand
 * and would otherwise print a pipeline run into the test report — and for the
 * few places a logger is genuinely optional. Not registered by the module:
 * a silent logger in a running service is a bug that hides every other one.
 */
export class SilentLogger extends Logger {
  log(): void {}
  error(): void {}
  warn(): void {}
  debug(): void {}
  verbose(): void {}

  child(_context: LogContext): Logger {
    return this;
  }
}
