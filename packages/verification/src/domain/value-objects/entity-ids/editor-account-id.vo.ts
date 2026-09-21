import { EntityId } from '@cadastre/shared';

/**
 * The account of the operator who last corrected a field by hand.
 *
 * An id from another context, held by value, exactly as an `OwnerAccountId` is:
 * accounts own their own database, so there is no foreign key here and no join
 * anywhere (ADR-0029). This context knows one thing about an editor — that two
 * corrections carrying the same id were made by the same person — and
 * deliberately knows nothing else. Turning it into a name is the edge's
 * business, and today nothing does: the screen shows the date (COMM-122).
 */
export class EditorAccountId extends EntityId {
  declare private readonly __type: 'EditorAccountId';

  static of(value: string): EditorAccountId {
    return new EditorAccountId(value);
  }

  /** The editor as a field may have none: every value nobody has touched. */
  static orNone(value: string | null): EditorAccountId | null {
    return value === null ? null : EditorAccountId.of(value);
  }
}
