/**
 * What the app is told about its surroundings at build time. Kept beside
 * `paths` — the routes are where the app goes, this is where it reaches — and
 * dependency-free for the same reason.
 */

/**
 * The archive register's origin, as the browser addresses it.
 *
 * `apps/web` speaks `@cadastre/api-contracts` through `libs/api-gateway` and
 * nothing else. Two things still do not, and both are deliberately outside the
 * contract: the register's workbook import, because no verification of a
 * submission ever loads a register file (ADR-0011 §1), and the register's own
 * liveness, because whether a stand-in process is up is a fact about this
 * deployment. The archive search used to be a third and is not any more — it is
 * in the contract, and since COMM-55 the gateway publishes a route over it.
 * Recorded as a testing-phase exception in TECH_DEBT §10.
 *
 * The default is a path and not a port: `/registry` is proxied to the register
 * by the dev server, which keeps the browser on one origin. The register sends
 * no CORS headers, and it has no authentication either, so an origin it answers
 * directly is a decision somebody has to take deliberately.
 */
export const registryBase = import.meta.env.VITE_REGISTRY_BASE ?? '/registry';
