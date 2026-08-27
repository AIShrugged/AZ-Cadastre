import { Command } from '@nestjs/cqrs';

import type { PresignedUpload } from '../../../ports/outbound/index.js';

export class PresignUploadCommand extends Command<PresignedUpload> {
  constructor(
    public readonly filename: string,
    public readonly contentType: string,
    public readonly size: number,
  ) {
    super();
  }
}
