import { EntityId } from '@cadastre/shared';

export class PackageId extends EntityId {
  // `__type` makes the id nominal: without it every id satisfies every
  // signature, and a DocumentId passes where a PageId was meant.
  declare private readonly __type: 'PackageId';

  static of(value: string): PackageId {
    return new PackageId(value);
  }
}
