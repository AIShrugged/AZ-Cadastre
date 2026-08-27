import { beforeEach, describe, expect, it } from 'vitest';

import type { ArchiveRecordDto } from '@cadastre/api-contracts/registry';
import { SilentLogger } from '@cadastre/logger';

import { AddressesService } from './addresses.service.js';
import { RegistrySource } from './ports/index.js';

const ZIG: ArchiveRecordDto = {
  registerNo: '1-12345',
  inventoryNo: 'İnv-4471',
  address: 'Bakı şəhəri, Suraxanı rayonu, Zığ qəsəbəsi, H.Əliyev küçəsi, ev 12',
  ownerName: 'Əliyeva Rübabə Kavı qızı',
  cadastralNumber: '40-12-345-67',
  plotArea: '600 m²',
  location: { folder: '14', pages: '01-dən 30' },
  documents: [
    {
      name: 'Ərizə',
      holding: 'Held',
      number: '1126012493',
      issuedOn: null,
      issuingAuthority: null,
      location: null,
    },
    // The presence register of this settlement wrote `-` against the decree
    // extract: the archive knows the paper is not in the file.
    {
      name: 'Sərəncam çıxarışı',
      holding: 'NotHeld',
      number: null,
      issuedOn: null,
      issuingAuthority: null,
      location: null,
    },
  ],
};

class StubSource extends RegistrySource {
  constructor(private readonly held: readonly ArchiveRecordDto[]) {
    super();
  }

  async findByAddress(): Promise<readonly ArchiveRecordDto[]> {
    return this.held;
  }

  async size(): Promise<number> {
    return this.held.length;
  }
}

function serviceOver(records: readonly ArchiveRecordDto[]): AddressesService {
  return new AddressesService(new SilentLogger(), new StubSource(records));
}

describe('AddressesService', () => {
  let found: AddressesService;

  beforeEach(() => {
    found = serviceOver([ZIG]);
  });

  it('hands back the record and the address as the register spells it', async () => {
    const answer = await found.lookup({
      address: ZIG.address,
      attributes: [],
      documents: [],
    });

    expect(answer.outcome).toBe('Found');
    expect(answer.record?.registerNo).toBe('1-12345');
    expect(answer.canonicalAddress).toContain('Zığ qəsəbəsi');
  });

  it('says an attribute matches when the rule for it forgives the spelling', async () => {
    const answer = await found.lookup({
      address: ZIG.address,
      attributes: [
        { name: 'ownerName', value: 'Əliyeva Rübabə Kavı qızına' },
        { name: 'plotArea', value: '600,00 kv.m' },
        { name: 'cadastralNumber', value: '40 12 345 67' },
      ],
      documents: [],
    });

    expect(answer.attributes.map(attribute => attribute.match)).toEqual([
      'Matches',
      'Matches',
      'Matches',
    ]);
  });

  it('says an attribute differs, and states both sides', async () => {
    const answer = await found.lookup({
      address: ZIG.address,
      attributes: [{ name: 'ownerName', value: 'Həsənova Sevinc Əli qızı' }],
      documents: [],
    });

    expect(answer.attributes[0]).toMatchObject({
      match: 'Differs',
      recorded: 'Əliyeva Rübabə Kavı qızı',
    });
  });

  // A register that never carried the column is silent, not in disagreement.
  it('says nothing is recorded when the record does not carry the field', async () => {
    const service = serviceOver([{ ...ZIG, cadastralNumber: null }]);

    const answer = await service.lookup({
      address: ZIG.address,
      attributes: [{ name: 'cadastralNumber', value: '40-12-345-67' }],
      documents: [],
    });

    expect(answer.attributes[0]?.match).toBe('NotRecorded');
  });

  it('says nothing is recorded for a field the register does not know at all', async () => {
    const answer = await found.lookup({
      address: ZIG.address,
      attributes: [{ name: 'storeys', value: '2' }],
      documents: [],
    });

    expect(answer.attributes[0]?.match).toBe('NotRecorded');
  });

  it('holds no record when the register has none', async () => {
    const answer = await serviceOver([]).lookup({
      address: 'Bakı şəhəri, Nizami rayonu, Yeni küçə, ev 1',
      attributes: [],
      documents: [],
    });

    expect(answer).toMatchObject({
      outcome: 'NotFound',
      record: null,
      candidates: 0,
    });
  });

  // Two records for one address is an answer, not a failure — and it hands back
  // no record, because acting on either would be a guess.
  it('refuses to choose when more than one record answers', async () => {
    const answer = await serviceOver([
      ZIG,
      { ...ZIG, registerNo: '1-12345-D' },
    ]).lookup({ address: ZIG.address, attributes: [], documents: [] });

    expect(answer).toMatchObject({
      outcome: 'Ambiguous',
      record: null,
      candidates: 2,
    });
    expect(answer.note).toContain('1-12345-D');
  });

  describe('the papers it was asked about', () => {
    it('says the archive holds one, and where the file is', async () => {
      const answer = await found.lookup({
        address: ZIG.address,
        attributes: [],
        documents: [{ name: 'Ərizə', type: 'application' }],
      });

      expect(answer.documents[0]).toMatchObject({
        name: 'Ərizə',
        type: 'application',
        holding: 'Held',
        number: '1126012493',
      });
    });

    /*
     * The whole of the third case: the record is there, the figures agree, and
     * one of the papers the submission rests on was never filed. Decree 439 §7
     * makes that the question rather than a footnote — but it is still a fact
     * and not a verdict, and what it costs is the caller's rule.
     */
    it('says the archive does not hold one it wrote a minus against', async () => {
      const answer = await found.lookup({
        address: ZIG.address,
        attributes: [],
        documents: [{ name: 'Sərəncam çıxarışı', type: 'disposal_order' }],
      });

      expect(answer.documents[0]).toMatchObject({
        holding: 'NotHeld',
        type: 'disposal_order',
      });
    });

    /*
     * Not the same as `NotHeld`, and the distinction is the reason there are
     * three states: the presence registers are kept per settlement and their
     * columns differ, so a kind that area never recorded is silence.
     */
    it('is silent about a kind of paper its register never had a column for', async () => {
      const answer = await found.lookup({
        address: ZIG.address,
        attributes: [],
        documents: [{ name: 'Vərəsəlik şəhadətnaməsi', type: 'inheritance' }],
      });

      expect(answer.documents[0]?.holding).toBe('Unknown');
    });

    it('hands the caller its own type key back untouched', async () => {
      const answer = await found.lookup({
        address: ZIG.address,
        attributes: [],
        documents: [{ name: 'Ərizə', type: 'application' }],
      });

      expect(answer.documents[0]?.type).toBe('application');
    });

    it('has nothing to say about papers when it found no record', async () => {
      const answer = await serviceOver([]).lookup({
        address: 'Bakı şəhəri, Nizami rayonu, Yeni küçə, ev 1',
        attributes: [],
        documents: [{ name: 'Ərizə', type: 'application' }],
      });

      expect(answer.documents).toEqual([]);
    });
  });

  it('never answers with a verdict about the submission', async () => {
    const answer = await found.lookup({
      address: ZIG.address,
      attributes: [],
      documents: [],
    });

    expect(answer).not.toHaveProperty('valid');
  });
});
