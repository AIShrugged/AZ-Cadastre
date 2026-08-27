import { EntityId } from '@cadastre/shared';

export class PageId extends EntityId {
  // `__type` makes the id nominal: without it every id satisfies every
  // signature, and a DocumentId passes where a PageId was meant.
  declare private readonly __type: 'PageId';

  static of(value: string): PageId {
    return new PageId(value);
  }
}
