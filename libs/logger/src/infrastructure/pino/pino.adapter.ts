import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import type pino from 'pino';

import { Logger, type LogContext } from '../../application/index.js';
import {
  LOGGER_OPTIONS,
  type LoggerModuleOptions,
} from '../../logger.module-defs.js';

import { boundContext } from './bind-context.js';
import { createPinoLogger } from './pino.factory.js';

type Level = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

class PinoLogger extends Logger {
  constructor(protected readonly logger: pino.Logger) {
    super();
  }

  log(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.write('error', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.write('debug', message, context);
  }

  verbose(message: string, context?: LogContext): void {
    this.write('trace', message, context);
  }

  fatal(message: string, context?: LogContext): void {
    this.write('fatal', message, context);
  }

  /** Reuses the underlying stream — no second destination per child. */
  child(context: LogContext): Logger {
    return new PinoLogger(this.logger.child(context));
  }

  /**
   * Nest hands Errors and plain objects to error()/log() as the "message";
   * pino would render those as an empty msg, so they move into the payload.
   */
  protected write(level: Level, message: unknown, context?: unknown): void {
    const bound = boundContext(context);

    if (typeof message === 'string') {
      this.logger[level](bound, message);
      return;
    }

    if (message instanceof Error) {
      this.logger[level]({ ...bound, err: message }, message.message);
      return;
    }

    this.logger[level]({ ...bound, payload: message }, String(message));
  }
}

/**
 * Implements both the Logger port and Nest's LoggerService, so the same
 * instance can be injected by our code and handed to `app.useLogger()` — which
 * routes every framework line through pino as well.
 */
@Injectable()
export class PinoLoggerAdapter extends PinoLogger implements LoggerService {
  constructor(@Inject(LOGGER_OPTIONS) options: LoggerModuleOptions) {
    super(createPinoLogger(options));
  }
}
