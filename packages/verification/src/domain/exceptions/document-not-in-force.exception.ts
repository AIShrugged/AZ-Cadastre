import { DomainException } from '@cadastre/shared';

/**
 * A write aimed at a document a better scan has already replaced.
 *
 * Nothing the package states is worked out from such a paper (COMM-80), so a
 * correction made to it would be typed into the record and change nothing an
 * inspector ever reads. Refused rather than accepted quietly, and the message
 * names the document that took its place, because that is the one to correct.
 */
export class DocumentNotInForceException extends DomainException {
  override readonly code = 'DOCUMENT_NOT_IN_FORCE';

  constructor(
    public readonly documentId: string,
    public readonly supersededBy: string | null,
  ) {
    super(
      `Document ${documentId} is no longer in force` +
        (supersededBy === null ? '' : `; ${supersededBy} replaced it`),
    );
  }
}
