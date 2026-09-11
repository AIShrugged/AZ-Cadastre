import { DomainEvent } from '@cadastre/shared';

import type {
  DocumentType,
  PackageId,
  SourceFileId,
} from '../value-objects/index.js';

/**
 * A file reached a package in answer to something the package said it was short
 * of — a required paper nobody sent, a scan that was read badly, or a receipt
 * this profile takes at any time.
 *
 * Its own event and not `FilesAdded`, though the pipeline answers both the same
 * way: what makes this one worth telling apart is the target, and a run that
 * could not say what a file was sent for could not say afterwards whether it
 * answered (COMM-80).
 */
export class DocumentSupplied extends DomainEvent {
  override readonly type = 'verification.DocumentSupplied';

  // Named `fileCount` so the handler that answers this and `FilesAdded` reads
  // one shape: a supply is always exactly one file.
  readonly fileCount = 1;

  constructor(
    public readonly packageId: PackageId,
    public readonly sourceFileId: SourceFileId,
    public readonly expectedType: DocumentType,
    public readonly replaces: string | null,
  ) {
    super();
  }
}
