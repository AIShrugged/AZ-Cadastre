import { DomainEvent } from '@cadastre/shared';

import type { PackageId, VerificationProfile } from '../value-objects/index.js';

export class PackageSubmitted extends DomainEvent {
  override readonly type = 'verification.PackageSubmitted';

  constructor(
    public readonly packageId: PackageId,
    public readonly profile: VerificationProfile,
    public readonly fileCount: number,
  ) {
    super();
  }
}
