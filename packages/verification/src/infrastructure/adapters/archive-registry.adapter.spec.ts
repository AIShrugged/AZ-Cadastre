import { describe, expect, it } from 'vitest';

import { ArchiveRegistryAdapter } from './archive-registry.adapter.js';

const HELD =
  'Bakı şəhəri, Suraxanı rayonu, Zığ qəsəbəsi, H.Əliyev küçəsi, ev 12';

describe('ArchiveRegistryAdapter', () => {
  const registry = new ArchiveRegistryAdapter();

  it('answers with the record it holds, and where the paper is', async () => {
    const answer = await registry.addresses.lookup({
      address: HELD,
      attributes: [],
    });

    expect(answer.outcome).toBe('Found');
    expect(answer.record?.registerNo).toBe('1-12345');
    expect(answer.record?.location?.folder).toBe('14');
  });

  it('holds an attribute against the record', async () => {
    const answer = await registry.addresses.lookup({
      address: HELD,
      attributes: [{ name: 'ownerName', value: 'Quliyev Rəşad Tofiq oğlu' }],
    });

    expect(answer.attributes[0]?.match).toBe('Differs');
  });

  it('is silent about a field the record does not carry', async () => {
    const answer = await registry.addresses.lookup({
      address: HELD,
      attributes: [{ name: 'storeys', value: '2' }],
    });

    expect(answer.attributes[0]?.match).toBe('NotRecorded');
  });

  it('holds nothing under an address it was not given', async () => {
    const answer = await registry.addresses.lookup({
      address: 'Bakı şəhəri, Nizami rayonu, Yeni küçə, ev 1',
      attributes: [],
    });

    expect(answer.outcome).toBe('NotFound');
  });

  /*
   * The point of the note, and the reason this is asserted: the offline
   * stand-in compares letter for letter and forgives none of the spellings the
   * register does. A run that used it must not be read as a run against a
   * register (ADR-0009).
   */
  it('says in its own note that it is the stand-in, not a register', async () => {
    const answer = await registry.addresses.lookup({
      address: 'Zığ qəs., Əliyev küç. 12',
      attributes: [],
    });

    expect(answer.outcome).toBe('NotFound');
    expect(answer.note).toContain('offline');
  });
});
