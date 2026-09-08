import type { EntityId } from '@cadastre/shared';

// Every id column here is `@db.Uuid`, so Postgres answers a string that is not
// one with a driver error rather than no rows.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isStoredId(id: EntityId): boolean {
  return isUuid(id.value);
}

/** The same question about a string nobody has made an id of yet — a search term. */
export function isUuid(raw: string): boolean {
  return UUID.test(raw);
}
