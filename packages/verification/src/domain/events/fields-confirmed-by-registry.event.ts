import { DomainEvent } from '@cadastre/shared';

import type { PackageId } from '../value-objects/index.js';

// Readings the archive register held the same record of. Not a check being made
// — that is `RegistryCheckMade` — but the answer being laid onto the fields it
// was an answer about.
export class FieldsConfirmedByRegistry extends DomainEvent {
  override readonly type = 'verification.FieldsConfirmedByRegistry';

  constructor(
    public readonly packageId: PackageId,
    public readonly fieldCount: number,
  ) {
    super();
  }
}
