import { EntityId } from '@cadastre/shared';

// `__type` makes these nominal: without it every id satisfies every signature.
export class PackageId extends EntityId {
  declare private readonly __type: 'PackageId';

  static of(value: string): PackageId {
    return new PackageId(value);
  }
}

export class SourceFileId extends EntityId {
  declare private readonly __type: 'SourceFileId';

  static of(value: string): SourceFileId {
    return new SourceFileId(value);
  }
}

export class DocumentId extends EntityId {
  declare private readonly __type: 'DocumentId';

  static of(value: string): DocumentId {
    return new DocumentId(value);
  }
}

export class PageId extends EntityId {
  declare private readonly __type: 'PageId';

  static of(value: string): PageId {
    return new PageId(value);
  }
}
