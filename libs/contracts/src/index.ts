/**
 * @cadastre/contracts — the single source of truth for the HTTP DTOs shared
 * between the web app and the core service. Zod schemas for validation live
 * here; both sides consume the inferred types so no interface is duplicated.
 * Holds API DTOs only — never the domain model (ADR-0004).
 */
export * from "./documents.js";
export * from "./packages.js";
