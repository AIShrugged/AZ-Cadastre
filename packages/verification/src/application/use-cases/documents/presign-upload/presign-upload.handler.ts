import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import {
  ContentType,
  Filename,
  FileSize,
} from '../../../../domain/value-objects/index.js';
import {
  ObjectStorage,
  type PresignedUpload,
} from '../../../ports/outbound/index.js';

import { PresignUploadCommand } from './presign-upload.command.js';

@CommandHandler(PresignUploadCommand)
export class PresignUploadHandler implements ICommandHandler<
  PresignUploadCommand,
  PresignedUpload
> {
  constructor(@Inject(ObjectStorage) private readonly storage: ObjectStorage) {}

  /*
   * `async`, though nothing here is awaited: the two value objects below reject
   * the request by throwing, and a non-async handler throws them out of
   * `commandBus.execute()` synchronously rather than as a rejected promise. The
   * signature already promises otherwise, and a caller written as
   * `execute(...).catch(...)` — which is how the submission event handler calls
   * its command — would not catch it at all.
   */
  async execute(command: PresignUploadCommand): Promise<PresignedUpload> {
    FileSize.of(command.size);

    return this.storage.presignUpload({
      filename: Filename.create(command.filename),
      contentType: ContentType.of(command.contentType),
    });
  }
}
