import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from "@nestjs/common";
import { z } from "zod";

import { ObjectStorage } from "../application/ports/object-storage.port.js";

const PresignBody = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
});

@Controller("documents")
export class DocumentsController {
  constructor(private readonly storage: ObjectStorage) {}

  /** Issue a presigned URL the browser uses to PUT one document into storage. */
  @Post("presign")
  async presign(@Body() body: unknown) {
    const parsed = PresignBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(z.flattenError(parsed.error));
    }
    return this.storage.presignUpload(parsed.data);
  }
}
