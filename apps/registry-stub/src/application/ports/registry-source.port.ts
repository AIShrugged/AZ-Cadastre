import type { ArchiveRecordDto } from '@cadastre/api-contracts/registry';

/**
 * Where the records come from, as a port rather than as a file.
 *
 * The stand-in answers from fixtures; the ingested register files would answer
 * from a database, and a real state register from its own API. Searching is the
 * source's job and not the caller's: how an address is resolved is the one
 * thing each of those does differently.
 */
export abstract class RegistrySource {
  /** Every record that answers to this address, in no particular order. */
  abstract findByAddress(address: string): Promise<readonly ArchiveRecordDto[]>;

  /** How many records the source holds at all — for the audit line, not for a rule. */
  abstract size(): Promise<number>;
}
