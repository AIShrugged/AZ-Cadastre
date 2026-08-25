import type { ArchiveRegistryApi } from '@cadastre/api-contracts/registry';

/**
 * The archive register, as this context needs it.
 *
 * Typed by the published language rather than by a shape of our own, and
 * narrowed to the one area we call: whoever answers it — the stand-in seeded
 * from fixtures, an ingest of the register files, a real state register — is a
 * binding in the composition root and never a decision in here (ADR-0009).
 *
 * The register states facts and returns no verdict. What an absent record or a
 * differing owner means for a submission is the profile's rule, applied by the
 * stage that called this, so that the decision has one owner.
 */
export abstract class ArchiveRegistryPort {
  abstract readonly addresses: ArchiveRegistryApi['addresses'];
}
