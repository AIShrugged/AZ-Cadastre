import { EntityId } from '@cadastre/shared';

export class DocumentId extends EntityId {
  // `__type` makes the id nominal: without it every id satisfies every
  // signature, and a DocumentId passes where a PageId was meant.
  declare private readonly __type: 'DocumentId';

  static of(value: string): DocumentId {
    return new DocumentId(value);
  }
}
