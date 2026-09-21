import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import type { FieldEdit } from '../../../../domain/aggregates/index.js';
import {
  DocumentId,
  EditorAccountId,
  FieldKey,
  FieldValue,
  PackageId,
} from '../../../../domain/value-objects/index.js';
import { PackageNotFoundException } from '../../../exceptions/index.js';
import { VerificationPackageRepository } from '../../../ports/outbound/index.js';

import { EditDocumentFieldsCommand } from './edit-document-fields.command.js';

@CommandHandler(EditDocumentFieldsCommand)
export class EditDocumentFieldsHandler implements ICommandHandler<
  EditDocumentFieldsCommand,
  PackageId
> {
  constructor(
    @Inject(VerificationPackageRepository)
    private readonly packages: VerificationPackageRepository,
  ) {}

  async execute(command: EditDocumentFieldsCommand): Promise<PackageId> {
    const packageId = PackageId.of(command.packageId);
    const verification = await this.packages.findById(packageId);

    if (!verification) throw new PackageNotFoundException(packageId);

    const edits: FieldEdit[] = command.fields.map(field => ({
      key: FieldKey.create(field.name),
      value: field.value === null ? null : FieldValue.create(field.value),
    }));

    /*
     * Whether the document is this package's, whether the package is in a state
     * that takes a correction, whether the keys are in its schema and whether
     * anything actually changed are all the aggregate's to say: the state it is
     * in is the only thing that decides them, and that decision has one home.
     *
     * Saving is skipped where nothing changed, and that is not an optimisation.
     * A save would bump the version and, far worse, publish the event that
     * starts a run — so an operator pressing save twice would re-verify a
     * package that has been re-verified since the first press (ADR-0033).
     */
    if (
      verification.editFields(
        DocumentId.of(command.documentId),
        edits,
        EditorAccountId.of(command.editedByAccountId),
      )
    ) {
      await this.packages.save(verification);
    }

    return verification.id;
  }
}
