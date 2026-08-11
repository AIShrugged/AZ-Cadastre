/**
 * Canonical route paths. Kept in a standalone, dependency-free module so both
 * the route map and the components that navigate can import it without forming
 * an import cycle (routes.tsx → app-shell.tsx → paths).
 */
export const paths = {
  register: "/",
  new: "/new",
  /** The policy surface: which document types each profile expects. */
  profiles: "/profiles",
  /** One profile's policy sheet, addressable so it can be linked and returned to. */
  profile: (key: string) => `/profiles/${encodeURIComponent(key)}`,
  /** Verification details for a package. */
  package: (id: string) => `/package/${encodeURIComponent(id)}`,
}
