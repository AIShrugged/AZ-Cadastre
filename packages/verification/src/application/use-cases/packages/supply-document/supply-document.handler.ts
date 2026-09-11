import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { SourceFile } from '../../../../domain/entities/index.js';
import {
  ContentType,
  DocumentId,
  DocumentType,
  Filename,
  PackageId,
  StorageKey,
  SupplyTarget,
} from '../../../../domain/value-objects/index.js';
import { PackageNotFoundException } from '../../../exceptions/index.js';
import {
  IdGenerator,
  VerificationPackageRepository,
} from '../../../ports/outbound/index.js';

import { SupplyDocumentCommand } from './supply-document.command.js';

@CommandHandler(SupplyDocumentCommand)
export class SupplyDocumentHandler implements ICommandHandler<
  SupplyDocumentCommand,
  PackageId
> {
  constructor(
    @Inject(VerificationPackageRepository)
    private readonly packages: VerificationPackageRepository,
    @Inject(IdGenerator) private readonly ids: IdGenerator,
  ) {}

  async execute(command: SupplyDocumentCommand): Promise<PackageId> {
    const packageId = PackageId.of(command.packageId);
    const verification = await this.packages.findById(packageId);

    if (!verification) throw new PackageNotFoundException(packageId);

    const replaces = command.replacesDocumentId
      ? DocumentId.of(command.replacesDocumentId)
      : null;

    // Asked of the package before anything is built, so a caller naming a
    // document of somebody else's submission is told which refusal it is rather
    // than getting the vaguer "no such gap" from the aggregate.
    if (replaces) verification.documentWith(replaces);

    // Whether the package publishes a gap for this, and whether it will take a
    // file at all, are the aggregate's to say: the state it is in and the
    // papers it holds are the only things that decide either, and those
    // decisions have one home (ADR-0013, COMM-80).
    verification.supplyDocument(
      SourceFile.create(
        this.ids.sourceFileId(),
        Filename.create(command.file.originalFilename),
        ContentType.of(command.file.contentType),
        StorageKey.create(command.file.storageKey),
        SupplyTarget.of({
          expectedType: DocumentType.create(command.expectedType),
          replaces,
        }),
      ),
    );

    await this.packages.save(verification);

    return verification.id;
  }
}
