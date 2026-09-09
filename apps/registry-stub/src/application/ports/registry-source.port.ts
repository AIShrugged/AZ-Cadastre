import type { ArchiveRecordDto } from '@cadastre/api-contracts/registry';

/**
 * What the register holds under one stored source name.
 *
 * `source` is the name the rows themselves carry — `EMDK:Mulkuyat` — and not
 * the catalogue entry it names: which of the archive's registers a stored name
 * belongs to is the catalogue's question, and it is answered above this port.
 */
export type SourceHolding = {
  readonly source: string;
  readonly records: number;
  /** When a record of it was last written. Null only where a source holds none. */
  readonly loadedAt: Date | null;
};

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

  /**
   * The same records tallied by the source each was read out of, by source name
   * as stored. One line per name the source actually holds rows under and none
   * for a name it does not: a source that never arrived is not this port's to
   * know about.
   */
  abstract holdings(): Promise<readonly SourceHolding[]>;
}
