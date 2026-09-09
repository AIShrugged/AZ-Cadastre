import { beforeEach, describe, expect, it } from 'vitest';

import {
  bandOf,
  DEFAULT_SEARCH_THRESHOLD,
  SEARCH_DEFAULT_LIMIT,
  type ArchiveRecordDto,
  type ArchiveSearchRequest,
} from '@cadastre/api-contracts/registry';
import { SilentLogger } from '@cadastre/logger';

import { ArchiveSearchService } from './archive-search.service.js';
import {
  RegistrySource,
  type ArchiveCandidate,
  type SourceHolding,
} from './ports/index.js';

const ZIG: ArchiveRecordDto = {
  registerNo: '1-12345',
  inventoryNo: 'İnv-4471',
  address: 'Bakı şəhəri, Suraxanı rayonu, Zığ qəsəbəsi, H.Əliyev küçəsi, ev 12',
  ownerName: 'Əliyeva Rübabə Kavı qızı',
  cadastralNumber: '40-12-345-67',
  plotArea: '600 m²',
  location: { folder: '14', pages: '01-dən 30' },
  documents: [],
};

/**
 * The other house on the same street. It exists so that a search can be shown
 * narrowing rather than finding one record whatever it is asked.
 */
const NEIGHBOUR: ArchiveRecordDto = {
  ...ZIG,
  registerNo: '1-12346',
  inventoryNo: 'İnv-4472',
  address: 'Bakı şəhəri, Suraxanı rayonu, Zığ qəsəbəsi, H.Əliyev küçəsi, ev 14',
  ownerName: 'Həsənova Sevinc Əli qızı',
  cadastralNumber: '40-12-345-68',
};

function heldBy(
  record: ArchiveRecordDto,
  source: string,
  addresses: readonly string[] = [record.address],
): ArchiveCandidate {
  return { record, source, addresses };
}

/**
 * A source that narrows nothing and hands back everything it holds.
 *
 * Which is exactly what the port allows, and what makes this a spec about the
 * grading: the rule that decides what a record is worth lives above the port so
 * that the stand-in and whatever replaces it cannot grade one pair two ways
 * (ADR-0009 §8), and a source that pre-filtered here would be testing the
 * filter instead.
 */
class StubSource extends RegistrySource {
  constructor(private readonly held: readonly ArchiveCandidate[]) {
    super();
  }

  async findByAddress(): Promise<[]> {
    return [];
  }

  async findCandidates(): Promise<readonly ArchiveCandidate[]> {
    return this.held;
  }

  async size(): Promise<number> {
    return this.held.length;
  }

  async holdings(): Promise<readonly SourceHolding[]> {
    return [];
  }
}

function serviceOver(held: readonly ArchiveCandidate[]): ArchiveSearchService {
  return new ArchiveSearchService(new SilentLogger(), new StubSource(held));
}

/** A request with the defaults the contract publishes already filled in. */
function asking(criteria: Partial<ArchiveSearchRequest>): ArchiveSearchRequest {
  return {
    threshold: DEFAULT_SEARCH_THRESHOLD,
    limit: SEARCH_DEFAULT_LIMIT,
    ...criteria,
  };
}

describe('ArchiveSearchService', () => {
  let archive: ArchiveSearchService;

  beforeEach(() => {
    archive = serviceOver([
      heldBy(ZIG, 'EMDK:Mulkuyat'),
      heldBy(NEIGHBOUR, 'EMDK:Mulkuyat'),
    ]);
  });

  describe('the criteria it can be searched by', () => {
    /*
     * The whole of the first thing the screen asks for and the lookup cannot
     * do: a name is a way into the archive and not only something a found
     * record is checked against.
     */
    it('finds a record by the right holder alone', async () => {
      const answer = await archive.search(
        asking({ ownerName: 'Əliyeva Rübabə Kavı qızı' }),
      );

      expect(answer.matches).toHaveLength(1);
      expect(answer.matches[0]?.record.registerNo).toBe('1-12345');
      expect(answer.matches[0]?.confidence).toBe(1);
    });

    /*
     * And the parcel next to it comes back behind it rather than not at all: a
     * digit is the easiest thing on a plan to misread, so a near miss is
     * offered — and a reference forgives nothing, so it is never offered as
     * the parcel.
     */
    it('finds a record by the cadastral number alone', async () => {
      const answer = await archive.search(
        asking({ cadastralNumber: '40 12 345 67' }),
      );

      expect(answer.matches[0]).toMatchObject({
        confidence: 1,
        record: expect.objectContaining({ registerNo: '1-12345' }),
      });
      expect(answer.matches[1]?.confidence).toBeLessThan(
        DEFAULT_SEARCH_THRESHOLD + 0.2,
      );
    });

    // A name typed out of the Cyrillic by hand, which is how half of what an
    // operator types arrives.
    it('finds a record by a name that is nearly right', async () => {
      const answer = await archive.search(
        asking({ ownerName: 'Aliyeva Rubaba' }),
      );

      expect(answer.matches[0]?.record.registerNo).toBe('1-12345');
      expect(answer.matches[0]?.confidence).toBeLessThan(1);
      expect(bandOf(answer.matches[0]?.confidence ?? 0)).toBe('High');
    });

    // A parcel number typed as far as the operator has it off the plan.
    it('finds a record by part of a cadastral number', async () => {
      const answer = await archive.search(
        asking({ cadastralNumber: '40-12-345' }),
      );

      expect(answer.matched).toBe(2);
      expect(answer.matches[0]?.criteria[0]?.confidence).toBeLessThan(1);
    });

    /*
     * Several criteria narrow. The record that answers both is the answer, and
     * the record that answers one of them is behind it — which is the ordering
     * and not a filter, because the register does not know which of the two the
     * operator meant.
     */
    it('ranks the record that answers more of the question first', async () => {
      const answer = await archive.search(
        asking({
          address: 'Zığ qəsəbəsi, H.Əliyev küçəsi',
          ownerName: 'Əliyeva Rübabə Kavı qızı',
        }),
      );

      expect(answer.matches[0]?.record.registerNo).toBe('1-12345');
      expect(answer.matches[0]?.confidence).toBeGreaterThan(
        answer.matches[1]?.confidence ?? 1,
      );
    });
  });

  describe('how sure it says it is', () => {
    /*
     * The threshold is the caller's and not the register's: how much doubt is
     * worth reading through depends on why somebody is searching, and the
     * register does not know why (ADR-0009).
     */
    it('leaves out what does not reach the threshold it was given', async () => {
      const surname = { ownerName: 'Əliyeva' };

      const offered = await archive.search(
        asking({ ...surname, threshold: 0.4 }),
      );
      const withheld = await archive.search(
        asking({ ...surname, threshold: 0.9 }),
      );

      expect(offered.matches).toHaveLength(1);
      expect(withheld.matches).toHaveLength(0);
      // And it says which threshold it answered, so a late answer cannot be
      // read as the answer to a narrower question asked after it.
      expect(withheld.threshold).toBe(0.9);
    });

    it('says how many it compared and how many cleared the threshold', async () => {
      const answer = await archive.search(
        asking({ ownerName: 'Əliyeva Rübabə Kavı qızı' }),
      );

      expect(answer.considered).toBe(2);
      expect(answer.matched).toBe(1);
    });

    it('answers with no more than the page it was asked for', async () => {
      const answer = await archive.search(
        asking({ cadastralNumber: '40-12-345', limit: 1 }),
      );

      expect(answer.matches).toHaveLength(1);
      // The count is over everything that cleared the threshold, so a page can
      // say there is more behind it.
      expect(answer.matched).toBe(2);
    });

    /*
     * A register that never carried the column is silent, exactly as the lookup
     * answers `NotRecorded`. Silence is neither agreement nor disagreement:
     * it is left out of the confidence rather than scored as a zero, or a
     * record's standing would depend on which columns its office kept in 1998.
     */
    it('does not count a field the record is silent about', async () => {
      const silent = serviceOver([
        heldBy({ ...ZIG, cadastralNumber: null }, 'пасбаза'),
      ]);

      const answer = await silent.search(
        asking({
          ownerName: 'Əliyeva Rübabə Kavı qızı',
          cadastralNumber: '40-12-345-67',
        }),
      );

      expect(answer.matches[0]?.confidence).toBe(1);
      expect(answer.matches[0]?.criteria).toEqual([
        expect.objectContaining({ criterion: 'ownerName', confidence: 1 }),
        expect.objectContaining({
          criterion: 'cadastralNumber',
          confidence: null,
          recorded: null,
        }),
      ]);
    });

    it('offers no record that could answer nothing it was asked', async () => {
      const silent = serviceOver([
        heldBy({ ...ZIG, cadastralNumber: null }, 'пасбаза'),
      ]);

      const answer = await silent.search(
        asking({ cadastralNumber: '40-12-345-67', threshold: 0 }),
      );

      expect(answer.matches).toEqual([]);
    });

    /*
     * A record is found by any spelling the register holds, as the lookup finds
     * it — and it must then be graded against the words that found it, or a
     * record found by its `köhnə ünvan` is offered as a poor match for itself.
     */
    it('grades the address against the spelling that answered', async () => {
      const legacy = 'Zabrat-1 qəsəbəsi, Yeni məhəlləyə gedən yolun sol tərəfində'; // prettier-ignore
      const twoSpellings = serviceOver([
        heldBy(
          { ...ZIG, address: 'Bakı Şəhəri, Sabunçu rayonu, Zabrat qəsəbəsi' },
          'Bakı Əİ arxivi',
          ['Bakı Şəhəri, Sabunçu rayonu, Zabrat qəsəbəsi', legacy],
        ),
      ]);

      const answer = await twoSpellings.search(asking({ address: legacy }));

      expect(answer.matches[0]?.criteria[0]).toMatchObject({
        criterion: 'address',
        recorded: legacy,
        confidence: 1,
      });
    });
  });

  describe('where the records came from', () => {
    it('names the source of every record it offers, and its catalogue line', async () => {
      const answer = await archive.search(
        asking({ ownerName: 'Əliyeva Rübabə Kavı qızı' }),
      );

      expect(answer.matches[0]?.source).toEqual({
        name: 'EMDK:Mulkuyat',
        register: 'EMDK',
      });
      expect(answer.sources).toEqual(['EMDK:Mulkuyat']);
    });

    /*
     * The Hövsan handover pair: one house, recorded by two offices, with the
     * holder of record changed between them (ADR-0010). Which of the two is
     * right is not the register's to say — it says that they differ, quotes
     * both, and somebody who can open the folder decides.
     */
    it('says when two sources answer for one property and disagree', async () => {
      const address =
        'Bakı şəhəri, Xəzər rayonu, Hövsan qəsəbəsi, Nəsimi küçəsi, ev 4';
      const handover = serviceOver([
        heldBy(
          {
            ...ZIG,
            registerNo: '308011000692',
            address,
            ownerName: 'Məmmədov Elçin Vaqif oğlu',
            cadastralNumber: null,
          },
          'Hövsan:təhvil verilən',
        ),
        heldBy(
          {
            ...ZIG,
            registerNo: '006011006603',
            address,
            ownerName: 'Məmmədova Sevil Elçin qızı',
            cadastralNumber: null,
          },
          'Hövsan:qəbul edilən',
        ),
      ]);

      const answer = await handover.search(asking({ address }));

      expect(answer.disagreements).toHaveLength(1);
      expect(answer.disagreements[0]?.field).toBe('ownerName');
      expect(answer.disagreements[0]?.statements).toEqual(
        expect.arrayContaining([
          {
            source: 'Hövsan:təhvil verilən',
            value: 'Məmmədov Elçin Vaqif oğlu',
          },
          {
            source: 'Hövsan:qəbul edilən',
            value: 'Məmmədova Sevil Elçin qızı',
          },
        ]),
      );
      // And the rows themselves are flagged, so a reader is not left joining
      // two lists to find out the record in front of them is contested.
      expect(answer.matches.every(match => match.disputed)).toBe(true);
    });

    /*
     * One source holding two records for one address is that register's own
     * ambiguity — which the lookup already answers as `Ambiguous` — and not the
     * archive's sources contradicting each other. Reporting it as one would be
     * a different claim than the data supports.
     */
    it('does not call one source holding two records a disagreement', async () => {
      const twice = serviceOver([
        heldBy(ZIG, 'EMDK:Mulkuyat'),
        heldBy(
          { ...ZIG, registerNo: '1-12345-D', ownerName: 'Həsənov Elçin' },
          'EMDK:Mulkuyat',
        ),
      ]);

      const answer = await twice.search(asking({ address: ZIG.address }));

      expect(answer.matched).toBe(2);
      expect(answer.disagreements).toEqual([]);
      expect(answer.matches.some(match => match.disputed)).toBe(false);
    });

    // Silence is not a contradiction: a register with no column for a field
    // says nothing about it, and nothing contradicts nothing.
    it('is not a disagreement when one of the two sources is silent', async () => {
      const silent = serviceOver([
        heldBy(ZIG, 'EMDK:Mulkuyat'),
        heldBy(
          { ...ZIG, registerNo: '2257', cadastralNumber: null },
          'пасбаза',
        ),
      ]);

      const answer = await silent.search(asking({ address: ZIG.address }));

      expect(
        answer.disagreements.map(disagreement => disagreement.field),
      ).not.toContain('cadastralNumber');
    });
  });

  it('never answers with a verdict, or with a band', async () => {
    const answer = await archive.search(
      asking({ ownerName: 'Əliyeva Rübabə Kavı qızı' }),
    );

    expect(answer).not.toHaveProperty('valid');
    // The register answers with the number it computed. The four bands are a
    // vocabulary for whoever shows it, drawn at the floors the contract names.
    expect(answer.matches[0]).not.toHaveProperty('band');
  });
});
