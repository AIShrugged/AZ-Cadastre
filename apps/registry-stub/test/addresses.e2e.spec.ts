import { beforeAll, describe, expect, inject, it } from 'vitest';

import type {
  AddressLookupRequest,
  AddressLookupResponse,
} from '@cadastre/api-contracts/registry';
import type { ErrorBody } from '@cadastre/api-contracts/shared';

let baseUrl: string;

beforeAll(() => {
  baseUrl = inject('baseUrl');
});

async function lookup(
  body: unknown,
): Promise<{ status: number; body: AddressLookupResponse & ErrorBody }> {
  const response = await fetch(`${baseUrl}/api/addresses/lookup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  return { status: response.status, body: await response.json() };
}

const ZIG: AddressLookupRequest = {
  // Abbreviated, out of order and without the city — the way a submission
  // writes it, and not at all the way the register holds it.
  address: 'Suraxanı r., Zığ qəs., H.Əliyev küç. 12',
  attributes: [],
};

describe('asking the register about an address', () => {
  it('resolves a spelling that is not the one the record holds', async () => {
    // act
    const { status, body } = await lookup(ZIG);

    // assert
    expect(status).toBe(201);
    expect(body.outcome).toBe('Found');
    expect(body.record?.registerNo).toBe('1-12345');
  });

  it('hands back the address as the register spells it', async () => {
    // act
    const { body } = await lookup(ZIG);

    // assert
    expect(body.canonicalAddress).toContain('Zığ qəsəbəsi');
  });

  it('says where the paper is, which is what the inspector needs next', async () => {
    // act
    const { body } = await lookup(ZIG);

    // assert — a page range is a string: "01-dən 30" is a real value
    expect(body.record?.location).toEqual({
      folder: '14',
      pages: '01-dən 30',
    });
  });

  it('resolves an address the register holds in the legacy Cyrillic code page', async () => {
    // act
    const { body } = await lookup({
      address: 'Nərimanov rayonu, 28 May küçəsi, ev 15',
      attributes: [],
    });

    // assert
    expect(body.outcome).toBe('Found');
    expect(body.record?.registerNo).toBe('4-01180');
  });

  it('holds nothing under an address that was never privatised', async () => {
    // act
    const { body } = await lookup({
      address: 'Bakı şəhəri, Nizami rayonu, Yeni küçə, ev 1',
      attributes: [],
    });

    // assert
    expect(body).toMatchObject({ outcome: 'NotFound', record: null });
  });

  // Two records for one address is an answer, not a failure — and it hands back
  // no record, because acting on either would be a guess.
  it('refuses to choose when two records answer to one address', async () => {
    // act
    const { body } = await lookup({
      address: 'Biləcəri qəsəbəsi, Dostluq küçəsi, ev 3',
      attributes: [],
    });

    // assert
    expect(body).toMatchObject({
      outcome: 'Ambiguous',
      record: null,
      candidates: 2,
    });
  });
});

describe('what it says about the attributes it was given', () => {
  it('forgives a case ending, a unit and a separator', async () => {
    // act
    const { body } = await lookup({
      ...ZIG,
      attributes: [
        { name: 'ownerName', value: 'Əliyeva Rübabə Kavı qızına' },
        { name: 'plotArea', value: '600,00 kv.m' },
        { name: 'cadastralNumber', value: '40 12 345 67' },
      ],
    });

    // assert
    expect(body.attributes.map(attribute => attribute.match)).toEqual([
      'Matches',
      'Matches',
      'Matches',
    ]);
  });

  it('states both sides of a difference rather than judging it', async () => {
    // act
    const { body } = await lookup({
      ...ZIG,
      attributes: [{ name: 'ownerName', value: 'Quliyev Rəşad Tofiq oğlu' }],
    });

    // assert
    expect(body.attributes[0]).toMatchObject({
      match: 'Differs',
      recorded: 'Əliyeva Rübabə Kavı qızı',
    });
  });

  /*
   * The register answers with facts and never a verdict: what a difference
   * means for a submission is the caller's profile's rule, and a register that
   * decided it would be a second owner of the decision (ADR-0009).
   */
  it('never answers with a verdict about the submission', async () => {
    // act
    const { body } = await lookup({
      ...ZIG,
      attributes: [{ name: 'ownerName', value: 'Quliyev Rəşad Tofiq oğlu' }],
    });

    // assert
    expect(body).not.toHaveProperty('valid');
    expect(body.outcome).toBe('Found');
  });

  it('is silent about a field its records do not carry', async () => {
    // act
    const { body } = await lookup({
      address: 'Ramana qəsəbəsi, Zirə küçəsi, ev 7',
      attributes: [{ name: 'cadastralNumber', value: '40-12-345-67' }],
    });

    // assert
    expect(body.attributes[0]?.match).toBe('NotRecorded');
  });
});

describe('what the register refuses', () => {
  it('refuses a body the published schema does not accept', async () => {
    // act
    const { status, body } = await lookup({ address: '' });

    // assert — the contract's one error shape, not a second one
    expect(status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  /*
   * Only the status. A path no controller serves is answered by Express with an
   * HTML page before Nest's filters are reached — the register inherits
   * TECH_DEBT §6 from the server, and fixing it means adding the body assertion
   * here rather than changing one.
   */
  it('answers a route nobody serves with 404', async () => {
    // act
    const response = await fetch(`${baseUrl}/api/nothing-here`);

    // assert
    expect(response.status).toBe(404);
  });
});
