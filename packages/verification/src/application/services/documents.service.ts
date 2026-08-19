import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import type {
  DocumentsApi,
  PresignRequest,
  PresignResponse,
} from '@cadastre/api-contracts/verification';

import { PresignUploadCommand } from '../use-cases/index.js';

@Injectable()
export class DocumentsService implements DocumentsApi {
  constructor(private readonly commands: CommandBus) {}

  async presign(request: PresignRequest): Promise<PresignResponse> {
    const presigned = await this.commands.execute(
      new PresignUploadCommand(
        request.filename,
        request.contentType,
        request.size,
      ),
    );

    return {
      key: presigned.key.value,
      url: presigned.url,
      // `ContentType.of` has already refused anything the contract does not
      // name.
      contentType: presigned.contentType
        .value as PresignResponse['contentType'],
      expiresIn: presigned.expiresIn,
    };
  }
}
