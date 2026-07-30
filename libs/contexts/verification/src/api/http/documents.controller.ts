import { Body, Controller, Post } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import {
  PresignRequestSchema,
  type PresignRequest,
  type PresignResponse,
} from "@cadastre/contracts";

import { PresignUploadCommand } from "../../application/use-cases/index.js";

@Controller("documents")
export class DocumentsController {
  constructor(private readonly commands: CommandBus) {}

  @Post("presign")
  async presign(
    @Body({ schema: PresignRequestSchema }) body: PresignRequest,
  ): Promise<PresignResponse> {
    const presigned = await this.commands.execute(
      new PresignUploadCommand(body.filename, body.contentType),
    );

    return {
      key: presigned.key.value,
      url: presigned.url,
      // `ContentType.of` has already refused anything the contract does not name.
      contentType: presigned.contentType
        .value as PresignResponse["contentType"],
      expiresIn: presigned.expiresIn,
    };
  }
}
