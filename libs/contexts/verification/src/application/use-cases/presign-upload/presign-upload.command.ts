import { Command } from "@nestjs/cqrs";

import type { PresignedUpload } from "../../ports/index.js";

export class PresignUploadCommand extends Command<PresignedUpload> {
  constructor(
    public readonly filename: string,
    public readonly contentType: string,
  ) {
    super();
  }
}
