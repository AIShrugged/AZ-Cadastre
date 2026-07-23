/**
 * Canonical route paths. Kept in a standalone, dependency-free module so both
 * the route map and the components that navigate can import it without forming
 * an import cycle (routes.tsx → app-shell.tsx → paths).
 */
export const paths = {
  register: "/",
  new: "/new",
  /** Verification details for a package. */
  package: (id: string) => `/package/${encodeURIComponent(id)}`,
}
