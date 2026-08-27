import { Module } from '@nestjs/common';

import { Logger } from './application/index.js';
import { PinoLoggerAdapter } from './infrastructure/index.js';
import { LoggerConfigurableModule } from './logger.module-defs.js';

/**
 * Global, because logging is not a dependency worth declaring on every module
 * that has something to say: the composition root registers it once and every
 * context, the edge and the framework itself write through the same instance.
 */
@Module({
  providers: [{ provide: Logger, useClass: PinoLoggerAdapter }],
  exports: [Logger],
})
export class LoggerModule extends LoggerConfigurableModule {}
