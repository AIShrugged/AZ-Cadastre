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
 * What the operator is searching the archive by, and how deep to look.
 *
 * The threshold travels with the criteria rather than staying above this port,
 * and it is not a filter the source applies: a record's confidence is the
 * average over the criteria it could answer, so it can never exceed the best of
 * them. That makes "the best single criterion reaches the threshold" the widest
 * net that cannot drop a record the service would have offered — and the source
 * is the only place that can narrow before reading the whole archive.
 */
export type ArchiveSearchCriteria = {
  readonly address?: string;
  readonly ownerName?: string;
  readonly cadastralNumber?: string;
  readonly threshold: number;
};

/**
 * One record a search might offer, with the two things the record itself does
 * not carry.
 *
 * `source` is where it was read out of, which is the whole of the answer to
 * "which register said this" — six overlapping registers contradict each other,
 * and an answer without its provenance is not usable (ADR-0010).
 *
 * `addresses` is every spelling the register holds for the property and not
 * only the one the record is filed under. A submission written against the
 * `köhnə ünvan` is about the same property, so the lookup searches all of them
 * — and a search that graded only the current spelling would score a record it
 * found by its legacy one as a poor match for the words that found it.
 */
export type ArchiveCandidate = {
  readonly record: ArchiveRecordDto;
  readonly source: string;
  readonly addresses: readonly string[];
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

  /**
   * Every record that could answer the search, in no particular order.
   *
   * Candidates and not matches: the source narrows, and what a record is
   * finally worth is graded once, above this port, so that the stand-in and
   * whatever replaces it cannot grade the same pair differently (ADR-0009 §8).
   * A source that can narrow no further is allowed to hand back everything it
   * holds.
   */
  abstract findCandidates(
    criteria: ArchiveSearchCriteria,
  ): Promise<readonly ArchiveCandidate[]>;

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
