import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import {
  PresignRequestSchema,
  type PresignResponse,
} from "@cadastre/contracts";
import { z } from "zod";

import { PresignUploadCommand } from "../../application/use-cases/index.js";

@Controller("documents")
export class DocumentsController {
  constructor(private readonly commands: CommandBus) {}

  @Post("presign")
  async presign(@Body() body: unknown): Promise<PresignResponse> {
    const parsed = PresignRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(z.flattenError(parsed.error));
    }

    const presigned = await this.commands.execute(
      new PresignUploadCommand(parsed.data.filename, parsed.data.contentType),
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
