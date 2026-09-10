import { DomainEvent } from '@cadastre/shared';

import type { PackageId } from '../value-objects/index.js';

// Fields no paper of the package yielded, closed with the value another paper
// of it states. Counted over the whole package and not per document: the stage
// works on the assembled envelope, which is the only place the question can be
// asked.
export class FieldsGathered extends DomainEvent {
  override readonly type = 'verification.FieldsGathered';

  constructor(
    public readonly packageId: PackageId,
    public readonly fieldCount: number,
  ) {
    super();
  }
}
