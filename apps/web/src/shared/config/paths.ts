/**
 * Canonical route paths. Kept in a standalone, dependency-free module so both
 * the route map and the components that navigate can import it without forming
 * an import cycle (routes.tsx → app-shell.tsx → paths).
 *
 * The map is the operator's day, in the order they move through it: look the
 * property up in the archive, take a packet in, work the register of cases.
 */
export const paths = {
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
};
