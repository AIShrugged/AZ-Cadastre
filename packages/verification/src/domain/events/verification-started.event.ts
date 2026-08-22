import { DomainEvent } from '@cadastre/shared';

import type { PackageId } from '../value-objects/index.js';

export class VerificationStarted extends DomainEvent {
  override readonly type = 'verification.VerificationStarted';

  constructor(public readonly packageId: PackageId) {
    super();
  }
}
