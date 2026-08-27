import { DomainEvent } from '@cadastre/shared';

import type { FailureReason, PackageId } from '../value-objects/index.js';

export class VerificationFailed extends DomainEvent {
  override readonly type = 'verification.VerificationFailed';

  constructor(
    public readonly packageId: PackageId,
    public readonly reason: FailureReason,
  ) {
    super();
  }
}
