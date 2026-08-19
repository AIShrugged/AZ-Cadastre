/**
 * The entire public surface of this context: the port it offers, the module
 * that wires it, and the shape of the configuration that module needs.
 *
 * Aggregates, use cases, repositories and ORM types are deliberately absent. If
 * something outside needs a shape from in here, it belongs in
 * `@cadastre/api-contracts` as a DTO.
 */
export { VerificationApiPort } from './application/ports/index.js';
export { VerificationModule } from './verification.module.js';
export type {
  VerificationModuleAsyncOptions,
  VerificationModuleOptions,
} from './verification.module-defs.js';
