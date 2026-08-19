import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { IdGenerator } from '../../application/ports/outbound/index.js';
import {
  DocumentId,
  PackageId,
  PageId,
  SourceFileId,
} from '../../domain/value-objects/index.js';

@Injectable()
export class UuidIdGenerator extends IdGenerator {
  override packageId(): PackageId {
    return PackageId.of(randomUUID());
  }

  override sourceFileId(): SourceFileId {
    return SourceFileId.of(randomUUID());
  }

  override documentId(): DocumentId {
    return DocumentId.of(randomUUID());
  }

  override pageId(): PageId {
    return PageId.of(randomUUID());
  }
}
