import { describe, expect, it } from 'vitest';

import {
  RegistrySummaryResponseSchema,
  type RegistrySourceSummaryDto,
  type RegistrySummaryResponse,
} from '@cadastre/api-contracts/registry';

import { readHoldings } from './holdings';

/** The catalogue's six, as the register lists them on an untouched database. */
const CATALOGUE = [
  'EMDK',
  'Hovsan',
  'Pasbaza',
  'QeyriYasayis',
  'TexPasport',
  'TorpaqKomitesi',
] as const;

const line = (
  id: string,
  records = 0,
  loadedAt: string | null = null,
): RegistrySourceSummaryDto => ({ id, records, loadedAt });

/**
 * A summary built the way the register builds one — totals derived from the
 * lines rather than written by hand, so a case here cannot state a breakdown
 * that does not add up to its own total.
 */
const summary = (
  bySource: RegistrySourceSummaryDto[],
): RegistrySummaryResponse =>
  RegistrySummaryResponseSchema.parse({
    sources: bySource.filter(source => source.records > 0).length,
    records: bySource.reduce((total, source) => total + source.records, 0),
    loadedAt:
      bySource
        .map(source => source.loadedAt)
        .filter((at): at is string => at !== null)
        .sort()
        .at(-1) ?? null,
    bySource,
  });

describe('readHoldings', () => {
  it('is asking, not silent, before the first answer', () => {
    const holdings = readHoldings({});

    expect(holdings.reach).toBe('asking');
    // No zeroes either: nothing is known yet, and a zero drawn from an unasked
    // register is a figure the register never sent.
    expect(holdings.records).toBe(0);
    expect(holdings.lines).toEqual([]);
  });

  it('reads an empty register as an answer, not as an absence', () => {
    const holdings = readHoldings({
      data: summary(CATALOGUE.map(id => line(id))),
    });

    expect(holdings.reach).toBe('answering');
    expect(holdings.sources).toBe(0);
    expect(holdings.records).toBe(0);
    expect(holdings.loadedAt).toBeNull();
    // Six lines and not none: which of the archive's registers has nothing in
    // it is the question a breakdown is opened to answer.
    expect(holdings.lines.map(l => l.id)).toEqual([...CATALOGUE]);
  });

  it('puts the sources that arrived above the ones that did not', () => {
    const holdings = readHoldings({
      data: summary([
        line('EMDK'),
        line('Hovsan', 1_204, '2026-09-01T08:00:00.000Z'),
        line('Pasbaza'),
        line('QeyriYasayis', 87, '2026-09-03T11:30:00.000Z'),
        line('TexPasport'),
        line('TorpaqKomitesi'),
      ]),
    });

    expect(holdings.sources).toBe(2);
    expect(holdings.records).toBe(1_291);
    expect(holdings.loadedAt).toBe('2026-09-03T11:30:00.000Z');
    expect(holdings.lines.map(l => l.id)).toEqual([
      // The two that hold something, in the register's own order …
      'Hovsan',
      'QeyriYasayis',
      // … then the four that hold nothing, also in the register's own order.
      'EMDK',
      'Pasbaza',
      'TexPasport',
      'TorpaqKomitesi',
    ]);
  });

  it('renders a source the catalogue has no name for', () => {
    // The register shows what is in its database rather than hiding rows: the
    // seed carries the archive's own spellings, and an import carries whatever
    // the operator wrote. Both are lines, and both count towards the total.
    const holdings = readHoldings({
      data: summary([
        line('Hövsan:təhvil verilən', 42, '2026-08-30T09:15:00.000Z'),
        line('Bakı Əİ arxivi', 7, '2026-08-30T09:15:00.000Z'),
        line('demo', 3, '2026-08-30T09:15:00.000Z'),
        ...CATALOGUE.map(id => line(id)),
      ]),
    });

    expect(holdings.sources).toBe(3);
    expect(holdings.records).toBe(52);
    expect(holdings.lines.slice(0, 3).map(l => l.id)).toEqual([
      'Hövsan:təhvil verilən',
      'Bakı Əİ arxivi',
      'demo',
    ]);
    expect(holdings.lines).toHaveLength(9);
  });

  it('says the register is quiet when the call fails', () => {
    const holdings = readHoldings({ isError: true });

    expect(holdings.reach).toBe('silent');
    expect(holdings.lines).toEqual([]);
  });

  it('drops the last answer when a later poll fails', () => {
    // The cached answer outlives the register that gave it. Printing those
    // figures beside a register that has stopped answering would report an
    // archive that is not there.
    const holdings = readHoldings({
      data: summary([line('EMDK', 900, '2026-09-01T08:00:00.000Z')]),
      isError: true,
    });

    expect(holdings.reach).toBe('silent');
    expect(holdings.records).toBe(0);
    expect(holdings.loadedAt).toBeNull();
    expect(holdings.lines).toEqual([]);
  });
});
