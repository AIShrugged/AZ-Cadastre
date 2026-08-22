import { EntityId } from '@cadastre/shared';

export class SourceFileId extends EntityId {
  // `__type` makes the id nominal: without it every id satisfies every
  // signature, and a DocumentId passes where a PageId was meant.
  declare private readonly __type: 'SourceFileId';

  static of(value: string): SourceFileId {
    return new SourceFileId(value);
  }
}
