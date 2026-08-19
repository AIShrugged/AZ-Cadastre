import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import {
  ContentType,
  FileSize,
  Filename,
} from "../../../domain/value-objects/index.js";
import { ObjectStorage, type PresignedUpload } from "../../ports/outbound/index.js";
import { PresignUploadCommand } from "./presign-upload.command.js";

@CommandHandler(PresignUploadCommand)
export class PresignUploadHandler
  implements ICommandHandler<PresignUploadCommand, PresignedUpload>
{
  constructor(private readonly storage: ObjectStorage) {}

  execute(command: PresignUploadCommand): Promise<PresignedUpload> {
    FileSize.of(command.size);

    return this.storage.presignUpload({
      filename: Filename.create(command.filename),
      contentType: ContentType.of(command.contentType),
    });
  }
}
