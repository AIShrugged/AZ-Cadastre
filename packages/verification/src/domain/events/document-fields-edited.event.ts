import { DomainEvent } from '@cadastre/shared';

import type { DocumentId, PackageId } from '../value-objects/index.js';

/**
 * An operator corrected fields on one document of a package by hand.
 *
 * The same shape of thing as a file arriving, with a smaller blast radius: the
 * package has re-opened, everything worked out across it is gone, and what has
 * to happen next is that the package is read again. That is why the handler
 * that answers a submission and an arrival answers this too, and why this is
 * not a shorter pipeline of its own — the correction may be a side of any
 * cross-document check, and working out which is a guess this system does not
 * make (COMM-122).
 */
export class DocumentFieldsEdited extends DomainEvent {
  override readonly type = 'verification.DocumentFieldsEdited';

  constructor(
    public readonly packageId: PackageId,
    public readonly documentId: DocumentId,
    // How many keys the operator stated a value for or struck out. Never zero:
    // an edit that changes nothing does not re-open the package and so is not
    // announced at all.
    public readonly fieldCount: number,
  ) {
    super();
  }
}
