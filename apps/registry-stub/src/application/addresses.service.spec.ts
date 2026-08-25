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
    const answer = await found.lookup({ address: ZIG.address, attributes: [] });

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
    });

    expect(answer.attributes[0]?.match).toBe('NotRecorded');
  });

  it('says nothing is recorded for a field the register does not know at all', async () => {
    const answer = await found.lookup({
      address: ZIG.address,
      attributes: [{ name: 'storeys', value: '2' }],
    });

    expect(answer.attributes[0]?.match).toBe('NotRecorded');
  });

  it('holds no record when the register has none', async () => {
    const answer = await serviceOver([]).lookup({
      address: 'Bakı şəhəri, Nizami rayonu, Yeni küçə, ev 1',
      attributes: [],
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
    ]).lookup({ address: ZIG.address, attributes: [] });

    expect(answer).toMatchObject({
      outcome: 'Ambiguous',
      record: null,
      candidates: 2,
    });
    expect(answer.note).toContain('1-12345-D');
  });

  it('never answers with a verdict about the submission', async () => {
    const answer = await found.lookup({ address: ZIG.address, attributes: [] });

    expect(answer).not.toHaveProperty('valid');
  });
});
