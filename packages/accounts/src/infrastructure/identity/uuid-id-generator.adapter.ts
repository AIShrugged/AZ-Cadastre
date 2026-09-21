import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { IdGenerator } from '../../application/ports/outbound/index.js';
import { AccountId } from '../../domain/value-objects/index.js';

@Injectable()
export class UuidIdGenerator extends IdGenerator {
  override accountId(): AccountId {
    return AccountId.of(randomUUID());
  }
}
