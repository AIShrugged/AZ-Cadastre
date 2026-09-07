import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Logger } from '@cadastre/logger';

import {
  RegistrySource,
  RegistryWriter,
  WorkbookClassifier,
  WorkbookReader,
} from '../application/ports/index.js';
import { REGISTRY_OPTIONS, type Environment } from '../config/index.js';

import {
  FingerprintWorkbookClassifier,
  OpenRouterWorkbookClassifier,
} from './classification/index.js';
import { ExcelJsWorkbookReader } from './excel/index.js';
import {
  PrismaRegistrySourceAdapter,
  PrismaRegistryWriterAdapter,
  RegistryPrismaService,
} from './persistence/index.js';

export {
  FingerprintWorkbookClassifier,
  OpenRouterWorkbookClassifier,
} from './classification/index.js';
export { ExcelJsWorkbookReader } from './excel/index.js';
export {
  PrismaRegistrySourceAdapter,
  PrismaRegistryWriterAdapter,
  RegistryPrismaService,
} from './persistence/index.js';

/**
 * What is behind the four ports this service has. The records come out of the
 * register's own database — seeded today with the cases the customer supplied,
 * loaded from the ingested register files tomorrow, and answered by a real state
 * register the day one exists. Which of those is behind them is these lines and
 * nothing above them (ADR-0009, ADR-0010).
 */
export const REGISTRY_INFRASTRUCTURE: Provider[] = [
  RegistryPrismaService,
  { provide: RegistrySource, useClass: PrismaRegistrySourceAdapter },
  { provide: RegistryWriter, useClass: PrismaRegistryWriterAdapter },
  // The two things here that are not the database. Reading an uploaded workbook
  // is a technical capability with a library behind it, and the import knows it
  // only as a port (ADR-0011).
  { provide: WorkbookReader, useClass: ExcelJsWorkbookReader },
  // Which of the archive's registers that workbook is, chosen per deployment
  // and not per file: the rule needs no key and no network and is what the
  // model-backed one is compared against (ADR-0012 §3).
  {
    provide: WorkbookClassifier,
    inject: [ConfigService, Logger],
    useFactory: (
      config: ConfigService<Environment, true>,
      logger: Logger,
    ): WorkbookClassifier => {
      const options = {
        classifier: config.get('classifier', { infer: true }),
        openrouter: config.get('openrouter', { infer: true }),
      };

      return options.classifier.provider === 'openrouter'
        ? new OpenRouterWorkbookClassifier(options, logger)
        : new FingerprintWorkbookClassifier(logger);
    },
  },
  // The same options under a token, so an adapter constructed by hand in a spec
  // is constructed the way the container constructs it.
  {
    provide: REGISTRY_OPTIONS,
    inject: [ConfigService],
    useFactory: (config: ConfigService<Environment, true>) => ({
      classifier: config.get('classifier', { infer: true }),
      openrouter: config.get('openrouter', { infer: true }),
    }),
  },
];
