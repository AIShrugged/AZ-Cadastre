/**
 * Canonical route paths. Kept in a standalone, dependency-free module so both
 * the route map and the components that navigate can import it without forming
 * an import cycle (routes.tsx → app-shell.tsx → paths).
 *
 * There are three sets of them, and which set a person may walk is decided by
 * the account they signed in with (ADR-0029):
 *
 *  - **The gate** — sign in and open an account. Outside the shell, and the only
 *    pair reachable with no session at all.
 *  - **The workspace** — the operator's day, in the order they move through it:
 *    look the property up in the archive, take a packet in, work the register of
 *    cases.
 *  - **The cabinet** — the applicant's own: what they have filed, a new
 *    submission, and one of them.
 *
 * The two signed-in sets never overlap, which is what lets the role decide the
 * map rather than each surface deciding for itself: a path that is not this
 * role's is a path they are sent home from (`app/routes.tsx`).
 *
 * A type-only import of the role and nothing else: this module stays free of
 * anything that could import it back.
 */
import type { AccountRole } from '@cadastre/api-contracts/accounts';

export const paths = {
  // ── The gate ──────────────────────────────────────────────────────────────
  /** Sign in. Where a session that has run out puts the reader back. */
  login: '/login',
  /**
   * Opening an account, which opens an applicant's and never the office's: an
   * operator is the office's own account and is seeded, never self-registered.
   */
  register: '/register',

  // ── The operator's workspace ──────────────────────────────────────────────
  /**
   * Archive search. The workspace opens here because it is what an operator
   * does before anything else: ask whether the property is already registered.
   */
  search: '/',
  /** Case pre-check: a packet is taken in, read, and reported on. */
  intake: '/intake',
  /** The register of cases the office has taken in. */
  cases: '/cases',
  /** One case, addressable so it can be linked to and returned to. */
  case: (id: string) => `/cases/${encodeURIComponent(id)}`,
  /**
   * The register from further away. Its own surface and not a band above the
   * register: taking the office's measure and finding one case are asked at
   * different moments.
   */
  analytics: '/analytics',

  // ── The applicant's cabinet ───────────────────────────────────────────────
  /** What this applicant has filed, and where each of them stands. */
  cabinet: '/my',
  /** Filing a new one: the papers, and what the claim is founded on. */
  newSubmission: '/my/new',
  /**
   * One submission, addressable for the same reason a case is. Static before
   * dynamic in the map, so `/my/new` is the form and never a submission whose
   * id is the word "new".
   */
  submission: (id: string) => `/my/${encodeURIComponent(id)}`,

  /**
   * Where a role's map begins — where signing in lands, and where somebody who
   * asked for a path belonging to the other role is put instead.
   *
   * Here rather than in the guard that redirects, because three places need the
   * answer and a home worked out at each of them is a home that comes to differ
   * by one of them.
   */
  home: (role: AccountRole): string => (role === 'operator' ? '/' : '/my'),
};
