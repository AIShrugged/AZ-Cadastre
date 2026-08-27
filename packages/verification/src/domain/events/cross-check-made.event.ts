import { DomainEvent } from '@cadastre/shared';

import type {
  CrossCheckKey,
  CrossCheckVerdict,
  PackageId,
} from '../value-objects/index.js';

export class CrossCheckMade extends DomainEvent {
  override readonly type = 'verification.CrossCheckMade';

  constructor(
    public readonly packageId: PackageId,
    public readonly key: CrossCheckKey,
    public readonly verdict: CrossCheckVerdict,
  ) {
    super();
  }
}
