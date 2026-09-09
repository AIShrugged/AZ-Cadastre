import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { VerificationPackage } from '../../../../domain/aggregates/index.js';
import { SourceFile } from '../../../../domain/entities/index.js';
import {
  ContentType,
  DeclaredAtIntake,
  DocumentType,
  Filename,
  StorageKey,
  VerificationProfile,
  type PackageId,
} from '../../../../domain/value-objects/index.js';
import {
  IdGenerator,
  VerificationPackageRepository,
} from '../../../ports/outbound/index.js';

import { CreatePackageCommand } from './create-package.command.js';

@CommandHandler(CreatePackageCommand)
export class CreatePackageHandler implements ICommandHandler<
  CreatePackageCommand,
  PackageId
> {
  constructor(
    @Inject(VerificationPackageRepository)
    private readonly packages: VerificationPackageRepository,
    @Inject(IdGenerator) private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreatePackageCommand): Promise<PackageId> {
    const declared = command.declared;

    const submitted = VerificationPackage.create(
      this.ids.packageId(),
      VerificationProfile.of(command.profileKey),
      command.files.map(file =>
        SourceFile.create(
          this.ids.sourceFileId(),
          Filename.create(file.originalFilename),
          ContentType.of(file.contentType),
          StorageKey.create(file.storageKey),
        ),
      ),
      // Whether the profile registers a right founded on this ground is the
      // aggregate's to say, not this handler's: it is the profile's own rule,
      // and a copy of it here would be a second place to change.
      DeclaredAtIntake.of({
        legalBasis: declared.legalBasis
          ? DocumentType.create(declared.legalBasis)
          : null,
        builtYear: declared.builtYear ?? null,
      }),
    );

    await this.packages.save(submitted);

    return submitted.id;
  }
}
