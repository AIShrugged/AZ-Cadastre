import { Command } from '@nestjs/cqrs';

import type { PackageId } from '../../../../domain/value-objects/index.js';
import type { SubmittedFile } from '../create-package/index.js';

/**
 * One file for a package that already exists, sent in for one of the gaps that
 * package publishes (COMM-80).
 *
 * The file arrives the same way every other does — presigned, PUT by the
 * browser, named here by the key the store handed back. What makes this a
 * different command from `AddFilesCommand` is the two fields under it: this
 * file answers something, and the package can say afterwards whether it did.
 */
export class SupplyDocumentCommand extends Command<PackageId> {
  constructor(
    public readonly packageId: string,
    public readonly file: SubmittedFile,
    // The profile document type the file is supposed to turn out to be, off one
    // of the published gaps.
    public readonly expectedType: string,
    // The document it is sent in place of, off an `UnusableScan` gap; null
    // where it answers a paper the package simply did not have.
    public readonly replacesDocumentId: string | null,
  ) {
    super();
  }
}
