/**
 * What the archive register holds, read the way a band on screen has to read
 * it.
 *
 * The register publishes facts and no verdict (ADR-0009): counts per source,
 * and the instant each last arrived. There is deliberately no "loaded enough"
 * in here either — how many of the archive's registers have to be in before the
 * archive is worth searching is nobody's rule that anyone has written down, so
 * this states the figures and lets the reader do the arithmetic.
 *
 * What it does add is the one thing the wire cannot carry: whether there is an
 * answer at all. Three states and not two — a register that has not been asked
 * yet is not a register that is down, and a band that reads "not answering" for
 * the half second before every answer would be lying twice a page.
 */
import type {
  RegistrySourceSummaryDto,
  RegistrySummaryResponse,
} from '@cadastre/api-contracts/registry';

/** Whether the register is answering, and whether it has been asked yet. */
export type ArchiveReach = 'asking' | 'answering' | 'silent';

export type ArchiveHoldings = {
  reach: ArchiveReach;
  /** Sources holding at least one record, as the register counted them. */
  sources: number;
  /** Every record the register holds, over all sources. */
  records: number;
  /** The most recent load over all sources, ISO-8601, or null on an empty register. */
  loadedAt: string | null;
  /** One line per source: the ones holding something first, then the rest. */
  lines: readonly RegistrySourceSummaryDto[];
};

/** The query's answer, narrowed to what a reading needs of it. */
export type SummaryAnswer = {
  data?: RegistrySummaryResponse;
  isError?: boolean;
};

const UNKNOWN = { sources: 0, records: 0, loadedAt: null, lines: [] } as const;

/**
 * The summary as the sidebar states it.
 *
 * A failure is checked before the data, and that is the whole of why this is a
 * function rather than a field read: a register that answered once and has
 * since gone quiet still has its last answer cached, and a band that kept
 * printing those figures would be reporting an archive that is not there. When
 * the register stops answering the figures go with it — the band says only what
 * it said before there were any numbers to say.
 */
export function readHoldings({
  data,
  isError,
}: SummaryAnswer): ArchiveHoldings {
  if (isError === true) return { reach: 'silent', ...UNKNOWN };
  if (data === undefined) return { reach: 'asking', ...UNKNOWN };

  return {
    reach: 'answering',
    // Passed through and never recounted. The register decides what "a source
    // that is in" means; a second tally here would be a second rule, and the
    // two would disagree the first time the first one changed.
    sources: data.sources,
    records: data.records,
    loadedAt: data.loadedAt,
    lines: orderLines(data.bySource),
  };
}

/**
 * Sources holding records first, then the ones holding none.
 *
 * Within each half the register's own order stands: it lists its catalogue
 * first and whatever else it holds after, which is an order that means
 * something, and re-sorting by size would throw it away for a ranking nobody
 * asked for. The split itself earns its keep — the interesting half of this
 * list is the sources that arrived, and on a register with one workbook in it
 * that half is one line under five empty ones.
 *
 * A line the catalogue has no name for is a line like any other. The register
 * shows what is in its database rather than hiding rows it cannot classify —
 * seeded cases carry the archive's own spellings and an imported workbook
 * carries whatever the operator wrote — so the breakdown here renders whatever
 * it is given and never a fixed six.
 */
function orderLines(
  bySource: readonly RegistrySourceSummaryDto[],
): RegistrySourceSummaryDto[] {
  return [
    ...bySource.filter(line => line.records > 0),
    ...bySource.filter(line => line.records === 0),
  ];
}
