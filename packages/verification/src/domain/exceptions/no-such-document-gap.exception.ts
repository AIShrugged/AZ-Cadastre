import { DomainException } from '@cadastre/shared';

/**
 * A file was sent in for something the package is not short of.
 *
 * The gaps are the server's own answer and the whole of what it will take
 * (COMM-80): a target that is not among them is either a screen offering an
 * upload the package has no room for, or a replacement of a document that is
 * already out of force. Refusing here is what keeps the published list and the
 * accepted call the same list.
 */
export class NoSuchDocumentGapException extends DomainException {
  override readonly code = 'NO_SUCH_DOCUMENT_GAP';

  constructor(
    public readonly packageId: string,
    public readonly expectedType: string,
    public readonly replaces: string | null,
  ) {
    super(
      replaces
        ? `Package ${packageId} publishes no gap for a "${expectedType}" in ` +
            `place of document ${replaces}: either that document is not a ` +
            `"${expectedType}" the run read badly, or it has already been replaced`
        : `Package ${packageId} publishes no gap for a "${expectedType}": it ` +
            `is neither missing from the required set nor a paper this profile ` +
            `takes at any time`,
    );
  }
}
