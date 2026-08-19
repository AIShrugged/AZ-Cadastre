import { Body, Controller, Post } from '@nestjs/common';

import {
  PresignRequestSchema,
  type PresignRequest,
  type PresignResponse,
} from '@cadastre/api-contracts/verification';

import { VerificationClientPort } from '../../../application/ports/index.js';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly verification: VerificationClientPort) {}

  @Post('presign')
  async presign(
    @Body({ schema: PresignRequestSchema }) body: PresignRequest,
  ): Promise<PresignResponse> {
    return this.verification.documents.presign(body);
  }
}
