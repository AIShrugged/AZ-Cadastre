import type { ArchiveRegistryApi } from '@cadastre/api-contracts/registry';

/**
 * How the edge reaches the archive register: the areas it actually calls, and
 * nothing more.
 *
 * The register is a system outside this one (ADR-0009) — not a context, and
 * never reached through one. Verification declares an outbound port of its own
 * over the same published slice because it asks the register a different
 * question, on a submission's behalf; this one is the operator's own search,
 * and routing it through the verification context would make the edge depend on
 * whether that context is running its register mocked.
 *
 * Typed by the contracts package, bound in the composition root — so the day a
 * real state register answers `@cadastre/api-contracts/registry`, the binding
 * changes and nothing here does.
 */
export abstract class RegistryClientPort {
  abstract readonly addresses: ArchiveRegistryApi['addresses'];
  abstract readonly summary: ArchiveRegistryApi['summary'];
}
