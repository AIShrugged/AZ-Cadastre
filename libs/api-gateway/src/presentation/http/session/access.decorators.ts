import { SetMetadata, type CustomDecorator } from '@nestjs/common';

import type { AccountRole } from '@cadastre/api-contracts/accounts';

export const ALLOWS_ANONYMOUS = 'cadastre:allows-anonymous';
export const REQUIRED_ROLES = 'cadastre:required-roles';

/**
 * The handful of routes that may be called with no session: registration,
 * sign-in and sign-out.
 *
 * Marked route by route rather than listed in one place, and the guard denies
 * by default, so a route added tomorrow is behind a session because nobody did
 * anything. A list of public paths is the other way round — a route is public
 * until somebody remembers the list — and that is the version that goes wrong
 * silently.
 */
export function AllowsAnonymous(): CustomDecorator<string> {
  return SetMetadata(ALLOWS_ANONYMOUS, true);
}

/**
 * Which roles may call this route. Absent means any role with a session, which
 * is what the table in ADR-0029 calls "yes" for both.
 */
export function RequiresRole(
  ...roles: readonly AccountRole[]
): CustomDecorator<string> {
  return SetMetadata(REQUIRED_ROLES, roles);
}
