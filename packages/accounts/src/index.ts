/**
 * The entire public surface of this context: the port it offers, the module
 * that wires it, and the shape of the configuration that module needs.
 *
 * The aggregate, the repository and the hasher are deliberately absent. If
 * something outside needs a shape from in here, it belongs in
 * `@cadastre/api-contracts` as a DTO — which is why the edge learns who
 * somebody is as an `AccountDto` and never as an `Account`.
 */
export { AccountsApiPort } from './application/ports/index.js';
export { AccountsModule } from './accounts.module.js';
export type {
  AccountsModuleAsyncOptions,
  AccountsModuleOptions,
} from './accounts.module-defs.js';
