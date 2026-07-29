import { Command } from "@nestjs/cqrs";

import type { PackageId } from "../../../domain/value-objects/index.js";

export type SubmittedDocument = {
  originalFilename: string;
  contentType: string;
  storageKey: string;
};

export class CreatePackageCommand extends Command<PackageId> {
  constructor(
    public readonly profileKey: string,
    public readonly documents: readonly SubmittedDocument[],
  ) {
    super();
  }
}
