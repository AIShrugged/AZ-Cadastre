import { EntityId } from '@cadastre/shared';

/**
 * The account that submitted a package.
 *
 * An id from another context, held by value: accounts own their own database,
 * so there is no foreign key here and no join anywhere (ADR-0029). This context
 * knows one thing about an owner — that two packages carrying the same id were
 * submitted by the same person — and deliberately knows nothing else, not the
 * address, not the name, not the role. Those are questions for the context that
 * owns them, and the edge is where the two answers meet.
 */
export class OwnerAccountId extends EntityId {
  declare private readonly __type: 'OwnerAccountId';

  static of(value: string): OwnerAccountId {
    return new OwnerAccountId(value);
  }

  /** The owner as a package may have none: every submission taken in before accounts existed. */
  static orNone(value: string | null): OwnerAccountId | null {
    return value === null ? null : OwnerAccountId.of(value);
  }
}
