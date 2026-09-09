import { describe, expect, it } from 'vitest';

import { ARCHIVE_REGISTERS } from '../domain/index.js';

import { RegistrySource, type SourceHolding } from './ports/index.js';
import { RegistrySummaryService } from './registry-summary.service.js';

class StubSource extends RegistrySource {
  constructor(private readonly tally: readonly SourceHolding[]) {
    super();
  }

  async findByAddress(): Promise<[]> {
    return [];
  }

  async size(): Promise<number> {
    return this.tally.reduce((total, one) => total + one.records, 0);
  }

  async holdings(): Promise<readonly SourceHolding[]> {
    return this.tally;
  }
}

function summaryOver(tally: readonly SourceHolding[]): RegistrySummaryService {
  return new RegistrySummaryService(new StubSource(tally));
}

const CATALOGUED = ARCHIVE_REGISTERS.map(register => register.id);

const AUGUST = new Date('2026-08-14T09:12:00Z');
const SEPTEMBER = new Date('2026-09-02T16:40:00Z');

describe('RegistrySummaryService', () => {
  /*
   * The state every deployment starts in, and the one the sidebar most needs to
   * be right about: a register that is up with nothing in it. It must not read
   * as six sources loaded — the catalogue is what the archive keeps, not what
   * arrived.
   */
  it('says nothing is loaded when the database is empty', async () => {
    // act
    const summary = await summaryOver([]).get();

    // assert
    expect(summary.sources).toBe(0);
    expect(summary.records).toBe(0);
    expect(summary.loadedAt).toBeNull();
  });

  it('still names every source the catalogue carries, at zero', async () => {
    // act
    const summary = await summaryOver([]).get();

    // assert — a line that vanishes at zero cannot be read as "not loaded"
    expect(summary.bySource.map(source => source.id)).toEqual(CATALOGUED);
    expect(summary.bySource.every(source => source.records === 0)).toBe(true);
    expect(summary.bySource.every(source => source.loadedAt === null)).toBe(
      true,
    );
  });

  describe('a partially loaded archive', () => {
    const partial = summaryOver([
      { source: 'EMDK:Mulkuyat', records: 40, loadedAt: AUGUST },
      { source: 'EMDK:Torpaq', records: 12, loadedAt: SEPTEMBER },
      { source: 'TorpaqKomitesi:DÖVLƏT AKTI', records: 7, loadedAt: AUGUST },
    ]);

    it('counts the sources that arrived and not the ones the archive keeps', async () => {
      // act
      const summary = await partial.get();

      // assert — two of the catalogue's six
      expect(summary.sources).toBe(2);
      expect(summary.records).toBe(59);
    });

    it('rolls the sheets of one register up into the register', async () => {
      // act
      const summary = await partial.get();

      // assert — the sheet is how a record says which column meant what; how
      // much of the archive is in is a question about the register
      expect(summary.bySource).toContainEqual({
        id: 'EMDK',
        records: 52,
        loadedAt: SEPTEMBER.toISOString(),
      });
    });

    it('dates each source by its own last load, and the archive by the latest', async () => {
      // act
      const summary = await partial.get();
      const land = summary.bySource.find(one => one.id === 'TorpaqKomitesi');

      // assert
      expect(land?.loadedAt).toBe(AUGUST.toISOString());
      expect(summary.loadedAt).toBe(SEPTEMBER.toISOString());
    });

    it('leaves the sources that never arrived on the list at zero', async () => {
      // act
      const summary = await partial.get();
      const absent = summary.bySource.filter(one => one.records === 0);

      // assert — which of the six is missing is the question being asked
      expect(absent.map(one => one.id)).toEqual([
        'Hovsan',
        'Pasbaza',
        'QeyriYasayis',
        'TexPasport',
      ]);
    });
  });

  /*
   * The seeded cases carry the archive's own name for the file they came off,
   * and the import template carries whatever the operator wrote in it. Neither
   * is a catalogue entry, and dropping them would print a breakdown that does
   * not add up to the total beside it.
   */
  it('states a source name the catalogue does not carry rather than losing its records', async () => {
    // act
    const summary = await summaryOver([
      { source: 'Bakı Əİ arxivi', records: 2, loadedAt: AUGUST },
      { source: 'EMDK:Mulkuyat', records: 3, loadedAt: AUGUST },
    ]).get();

    // assert
    expect(summary.sources).toBe(2);
    expect(summary.records).toBe(5);
    expect(summary.bySource).toContainEqual({
      id: 'Bakı Əİ arxivi',
      records: 2,
      loadedAt: AUGUST.toISOString(),
    });
    // The lines add up to the total they are printed beside.
    expect(
      summary.bySource.reduce((total, one) => total + one.records, 0),
    ).toBe(summary.records);
  });
});
