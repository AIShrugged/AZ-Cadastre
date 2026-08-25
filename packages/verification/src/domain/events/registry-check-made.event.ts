import { DomainEvent } from '@cadastre/shared';

import type {
  PackageId,
  RegistryCheckKey,
  RegistryOutcome,
} from '../value-objects/index.js';

export class RegistryCheckMade extends DomainEvent {
  override readonly type = 'verification.RegistryCheckMade';

  constructor(
    public readonly packageId: PackageId,
    public readonly key: RegistryCheckKey,
    public readonly outcome: RegistryOutcome,
  ) {
    super();
  }
}
