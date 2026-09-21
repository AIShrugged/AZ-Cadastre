import { Command } from '@nestjs/cqrs';

import type { PackageId } from '../../../../domain/value-objects/index.js';

/**
 * Every correction an operator made to one document of one package, saved
 * together (ADR-0033).
 *
 * The editor's account id is the edge's to supply and never the body's: it is
 * read off the session, so a caller cannot file a correction in somebody else's
 * name — the same rule that decides who owns a package (ADR-0029).
 */
export class EditDocumentFieldsCommand extends Command<PackageId> {
  constructor(
    public readonly packageId: string,
    public readonly documentId: string,
    // What the paper says under each key, as the operator reads it. A `null`
    // value is the operator stating the paper does not say it.
    public readonly fields: readonly {
      readonly name: string;
      readonly value: string | null;
    }[],
    public readonly editedByAccountId: string,
  ) {
    super();
  }
}
