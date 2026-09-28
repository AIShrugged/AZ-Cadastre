import { Command } from '@nestjs/cqrs';

import type {
  CaseParameterKey,
  PackageId,
} from '../../../../domain/value-objects/index.js';

/**
 * Every figure of the Article 8 decision table an operator set on one package,
 * saved together (COMM-193).
 *
 * The editor's account id is the edge's to supply and never the body's: it is
 * read off the session, so a caller cannot state a figure in somebody else's
 * name — the same rule that decides who owns a package (ADR-0029).
 */
export class StateCaseParametersCommand extends Command<PackageId> {
  constructor(
    public readonly packageId: string,
    // What the operator says the case is. A `null` value clears the override
    // and puts the figure back to what the papers say.
    public readonly parameters: readonly {
      readonly parameter: CaseParameterKey;
      readonly value: number | string | null;
    }[],
    public readonly editedByAccountId: string,
  ) {
    super();
  }
}
