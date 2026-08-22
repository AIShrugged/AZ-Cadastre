import type { Provider } from '@nestjs/common';

import { CreatePackageHandler } from './create-package/index.js';
import { GetPackageSummaryHandler } from './get-package-summary/index.js';
import { GetPackageHandler } from './get-package/index.js';
import { ListPackagesHandler } from './list-packages/index.js';
import { ListProfilesHandler } from './list-profiles/index.js';
import { PresignUploadHandler } from './presign-upload/index.js';
import { RunVerificationHandler } from './run-verification/index.js';

export {
  CreatePackageCommand,
  CreatePackageHandler,
  type SubmittedFile,
} from './create-package/index.js';
export { GetPackageHandler, GetPackageQuery } from './get-package/index.js';
export {
  GetPackageSummaryHandler,
  GetPackageSummaryQuery,
} from './get-package-summary/index.js';
export {
  ListPackagesHandler,
  ListPackagesQuery,
} from './list-packages/index.js';
export {
  ListProfilesHandler,
  ListProfilesQuery,
} from './list-profiles/index.js';
export {
  PresignUploadCommand,
  PresignUploadHandler,
} from './presign-upload/index.js';
export {
  RunVerificationCommand,
  RunVerificationHandler,
} from './run-verification/index.js';

/** One operation, one handler. The bus finds them by their decorator. */
export const VERIFICATION_CQRS_HANDLERS: Provider[] = [
  CreatePackageHandler,
  GetPackageHandler,
  GetPackageSummaryHandler,
  ListPackagesHandler,
  ListProfilesHandler,
  PresignUploadHandler,
  RunVerificationHandler,
];
