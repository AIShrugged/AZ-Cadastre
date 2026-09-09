import { Command } from '@nestjs/cqrs';

import type { PackageId } from '../../../../domain/value-objects/index.js';

export type SubmittedFile = {
  originalFilename: string;
  contentType: string;
  storageKey: string;
};

// What the office declared at the counter, as it comes off the wire: a document
// type key and a year, either of them absent. Turned into the domain's own
// vocabulary by the handler, which is where a basis nobody recognises is
// refused.
export type DeclaredAtIntakeInput = {
  readonly legalBasis?: string | null;
  readonly builtYear?: number | null;
};

export class CreatePackageCommand extends Command<PackageId> {
  constructor(
    public readonly profileKey: string,
    public readonly files: readonly SubmittedFile[],
    // Absent is a submission that declares nothing, which is what every package
    // taken in before intake asked is.
    public readonly declared: DeclaredAtIntakeInput = {},
  ) {
    super();
  }
}
