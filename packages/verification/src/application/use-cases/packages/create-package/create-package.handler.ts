import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { VerificationPackage } from '../../../../domain/aggregates/index.js';
import { SourceFile } from '../../../../domain/entities/index.js';
import {
  ContentType,
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
    );

    await this.packages.save(submitted);

    return submitted.id;
  }
}
