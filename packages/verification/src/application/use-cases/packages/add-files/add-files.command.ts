import { Command } from '@nestjs/cqrs';

import type { PackageId } from '../../../../domain/value-objects/index.js';
import type { SubmittedFile } from '../create-package/index.js';

/**
 * Files for a package that already exists. The same shape a submission carries,
 * because they arrived the same way: presigned, PUT by the browser, and named
 * here by the key the store handed back.
 */
export class AddFilesCommand extends Command<PackageId> {
  constructor(
    public readonly packageId: string,
    public readonly files: readonly SubmittedFile[],
  ) {
    super();
  }
}
