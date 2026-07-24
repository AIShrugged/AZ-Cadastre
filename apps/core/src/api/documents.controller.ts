import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from "@nestjs/common";
import { z } from "zod";
import {
  PresignRequestSchema,
  type PresignResponse,
} from "@cadastre/contracts";

import { ObjectStorage } from "../application/ports/object-storage.port.js";

@Controller("documents")
export class DocumentsController {
  constructor(private readonly storage: ObjectStorage) {}

  /** Issue a presigned URL the browser uses to PUT one document into storage. */
  @Post("presign")
  async presign(@Body() body: unknown): Promise<PresignResponse> {
    const parsed = PresignRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(z.flattenError(parsed.error));
    }
    const presigned = await this.storage.presignUpload(parsed.data);
    // The port types contentType loosely as string; it echoes the request, so
    // pin it back to the validated union the contract promises.
    return { ...presigned, contentType: parsed.data.contentType };
  }
}
