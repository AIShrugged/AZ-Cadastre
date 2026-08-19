import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { VerificationPackage } from "../../../domain/aggregates/index.js";
import { SourceFile } from "../../../domain/entities/index.js";
import { VerificationPackageRepository } from "../../../domain/repositories/index.js";
import {
  ContentType,
  Filename,
  type PackageId,
  StorageKey,
  VerificationProfile,
} from "../../../domain/value-objects/index.js";
import { IdGenerator } from "../../ports/outbound/index.js";
import { CreatePackageCommand } from "./create-package.command.js";

@CommandHandler(CreatePackageCommand)
export class CreatePackageHandler
  implements ICommandHandler<CreatePackageCommand, PackageId>
{
  constructor(
    private readonly packages: VerificationPackageRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreatePackageCommand): Promise<PackageId> {
    const submitted = VerificationPackage.create(
      this.ids.packageId(),
      VerificationProfile.of(command.profileKey),
      command.files.map((file) =>
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
