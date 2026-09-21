import type { EntityId } from '@cadastre/shared';

// The id column is `@db.Uuid`, so Postgres answers a string that is not one
// with a driver error rather than with no rows — and the id in a session cookie
// is a string a caller controls.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isStoredId(id: EntityId): boolean {
  return UUID.test(id.value);
}
