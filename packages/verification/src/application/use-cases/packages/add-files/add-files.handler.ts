import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { SourceFile } from '../../../../domain/entities/index.js';
import {
  ContentType,
  Filename,
  PackageId,
  StorageKey,
} from '../../../../domain/value-objects/index.js';
import {
  IdGenerator,
  VerificationPackageRepository,
} from '../../../ports/outbound/index.js';
import { loadInScope } from '../scoped-package.js';

import { AddFilesCommand } from './add-files.command.js';

@CommandHandler(AddFilesCommand)
export class AddFilesHandler implements ICommandHandler<
  AddFilesCommand,
  PackageId
> {
  constructor(
    @Inject(VerificationPackageRepository)
    private readonly packages: VerificationPackageRepository,
    @Inject(IdGenerator) private readonly ids: IdGenerator,
  ) {}

  async execute(command: AddFilesCommand): Promise<PackageId> {
    const verification = await loadInScope(
      this.packages,
      PackageId.of(command.packageId),
      command.ownerAccountId,
    );

    // Whether the package will take them is the aggregate's to say — the state
    // it is in is the only thing that decides it, and that decision has one
    // home (ADR-0013).
    verification.addFiles(
      command.files.map(file =>
        SourceFile.create(
          this.ids.sourceFileId(),
          Filename.create(file.originalFilename),
          ContentType.of(file.contentType),
          StorageKey.create(file.storageKey),
        ),
      ),
    );

    await this.packages.save(verification);

    return verification.id;
  }
}
