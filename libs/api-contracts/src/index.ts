/**
 * The whole published language, for consumers that would rather not name a
 * slice. Prefer the subpaths — `@cadastre/api-contracts/verification`,
 * `@cadastre/api-contracts/registry`, `@cadastre/api-contracts/shared` — so an
 * import says which language it is in.
 */
export * from './registry/index.js';
export * from './shared/index.js';
export * from './verification/index.js';
