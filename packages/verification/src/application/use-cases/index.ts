import type { Provider } from '@nestjs/common';

import { PresignUploadHandler } from './documents/index.js';
import {
  CreatePackageHandler,
  GetPackageHandler,
  GetPackageSummaryHandler,
  ListPackagesHandler,
  RunVerificationHandler,
} from './packages/index.js';
import { ListProfilesHandler } from './profiles/index.js';

export * from './documents/index.js';
export * from './packages/index.js';
export * from './profiles/index.js';

/**
 * One operation, one handler, grouped by the API section it serves — the same
 * three sections the contract publishes, so a reader who has the contract knows
 * where to look. The bus finds the handlers by their decorator; this array only
 * has to get them registered.
 */
export const VERIFICATION_CQRS_HANDLERS: Provider[] = [
  CreatePackageHandler,
  GetPackageHandler,
  GetPackageSummaryHandler,
  ListPackagesHandler,
  ListProfilesHandler,
  PresignUploadHandler,
  RunVerificationHandler,
];
