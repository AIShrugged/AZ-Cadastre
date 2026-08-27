import { DomainEvent } from '@cadastre/shared';

import type { PackageId } from '../value-objects/index.js';

export class VerificationCompleted extends DomainEvent {
  override readonly type = 'verification.VerificationCompleted';

  constructor(public readonly packageId: PackageId) {
    super();
  }
}
