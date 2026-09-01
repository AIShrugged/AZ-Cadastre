import type { Provider } from '@nestjs/common';

import {
  RegistrySource,
  RegistryWriter,
  WorkbookReader,
} from '../application/ports/index.js';

import { ExcelJsWorkbookReader } from './excel/index.js';
import {
  PrismaRegistrySourceAdapter,
  PrismaRegistryWriterAdapter,
  RegistryPrismaService,
} from './persistence/index.js';

export { ExcelJsWorkbookReader } from './excel/index.js';
export {
  PrismaRegistrySourceAdapter,
  PrismaRegistryWriterAdapter,
  RegistryPrismaService,
} from './persistence/index.js';

/**
 * What is behind the three ports this service has. The records come out of the
 * register's own database — seeded today with the cases the customer supplied,
 * loaded from the ingested register files tomorrow, and answered by a real state
 * register the day one exists. Which of those is behind them is these lines and
 * nothing above them (ADR-0009, ADR-0010).
 */
export const REGISTRY_INFRASTRUCTURE: Provider[] = [
  RegistryPrismaService,
  { provide: RegistrySource, useClass: PrismaRegistrySourceAdapter },
  { provide: RegistryWriter, useClass: PrismaRegistryWriterAdapter },
  // The one thing here that is not the database: reading an uploaded workbook is
  // a technical capability with a library behind it, and the import knows it
  // only as a port (ADR-0011).
  { provide: WorkbookReader, useClass: ExcelJsWorkbookReader },
];
