import type { Provider } from '@nestjs/common';

import {
  PackageQueries,
  VerificationPackageRepository,
} from '../../application/ports/outbound/index.js';

import { PackageQueriesAdapter } from './package-queries.adapter.js';
import { VerificationPackageRepositoryAdapter } from './verification-package-repository.adapter.js';
import { VerificationPrismaService } from './verification-prisma.service.js';

export { PackageQueriesAdapter } from './package-queries.adapter.js';
export { VerificationPackageRepositoryAdapter } from './verification-package-repository.adapter.js';
export {
  VerificationPackageMapper,
  type DocumentRow,
  type DocumentWrite,
  type FieldRow,
  type FieldWrite,
  type OcrRow,
  type OcrWrite,
  type PackageRow,
  type PackageWrite,
  type PageRow,
  type PageWrite,
} from './verification-package.mapper.js';
export { VerificationPrismaService } from './verification-prisma.service.js';

/**
 * The persistence half of the context, bound to the ports it implements. The
 * binding lives here rather than in the module so that adding an adapter is one
 * file and its neighbour, not one file and a trip to the wiring.
 */
export const VERIFICATION_PERSISTENCE: Provider[] = [
  VerificationPrismaService,
  {
    provide: VerificationPackageRepository,
    useClass: VerificationPackageRepositoryAdapter,
  },
  { provide: PackageQueries, useClass: PackageQueriesAdapter },
];
