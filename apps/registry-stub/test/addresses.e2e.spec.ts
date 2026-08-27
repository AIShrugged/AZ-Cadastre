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

// The confirmed case, written the way a submission writes it: abbreviated, out
// of order, without the postal code the register's own spelling starts with.
const ZABRAT: AddressLookupRequest = {
  address: 'Sabunçu r., Zabrat qəs., Qazı Məhəmmədov küç., giriş 95A',
  attributes: [],
  documents: [],
};

// The case whose figures do not add up.
const BUZOVNA: AddressLookupRequest = {
  address: 'Xəzər r., Buzovna qəs., 259-cu Buzovna küç., giriş 14',
  attributes: [],
  documents: [],
};

describe('asking the register about an address', () => {
  it('resolves a spelling that is not the one the record holds', async () => {
    // act
    const { status, body } = await lookup(ZABRAT);

    // assert
    expect(status).toBe(201);
    expect(body.outcome).toBe('Found');
    expect(body.record?.registerNo).toBe('005013055966-10301');
  });

  it('hands back the address as the register spells it', async () => {
    // act
    const { body } = await lookup(ZABRAT);

    // assert
    expect(body.record?.address).toContain('AZ 1104');
  });

  /*
   * The plot was allotted before the settlement had streets, so the extract
   * carries a `Köhnə ünvan` naming no street at all. A submission written
   * against the old form has to reach the same record as one written against
   * the new one, or half the archive is unreachable.
   */
  it('resolves the legacy spelling the same record also answers to', async () => {
    // act
    const { body } = await lookup({
      address: 'Bakı şəhəri, Xəzər rayonu, Buzovna qəsəbəsi, sahə 5-862',
      attributes: [],
      documents: [],
    });

    // assert
    expect(body.record?.registerNo).toBe('003013067339-10301');
  });

  it('says where the paper is, which is what the inspector needs next', async () => {
    // act
    const { body } = await lookup(ZABRAT);

    // assert — a page range is a string: "01-dən 44" is a real value
    expect(body.record?.location).toEqual({
      folder: '246',
      pages: '01-dən 44',
    });
  });

  /*
   * The technical-passport database is written in a Cyrillic code page that is
   * not Russian: "Щ.З.Таьыйев кцчяси" is H.Z.Tağıyev küçəsi. A Latin submission
   * has to reach it.
   */
  it('resolves an address the register holds in the legacy Cyrillic code page', async () => {
    // act
    const { body } = await lookup({
      address: 'Qusar şəhəri, H.Z.Tağıyev küçəsi',
      attributes: [],
      documents: [],
    });

    // assert
    expect(body.outcome).toBe('Found');
    expect(body.record?.registerNo).toBe('2257');
  });

  it('holds nothing under an address that was never privatised', async () => {
    // act
    const { body } = await lookup({
      address: 'Bakı şəhəri, Nizami rayonu, Yeni küçə, ev 1',
      attributes: [],
      documents: [],
    });

    // assert
    expect(body).toMatchObject({ outcome: 'NotFound', record: null });
  });

  /*
   * Two records for one address is an answer, not a failure — and it hands back
   * no record, because acting on either would be a guess. This pair is what the
   * 2008 handover between the Absheron and Baku offices left behind: the same
   * house, entered again under the receiving office's numbering.
   */
  it('refuses to choose when two records answer to one address', async () => {
    // act
    const { body } = await lookup({
      address: 'Hövsan qəsəbəsi, Nəsimi küçəsi, ev 4',
      attributes: [],
      documents: [],
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
  it('forgives a case ending and converts the unit', async () => {
    // act — the register holds 0.04 ha; the plan-scheme states it in metres
    const { body } = await lookup({
      ...ZABRAT,
      attributes: [
        { name: 'ownerName', value: 'Rusadze Vera Vladimirovna' },
        { name: 'plotArea', value: '400,00 kv.m' },
      ],
    });

    // assert
    expect(body.attributes.map(attribute => attribute.match)).toEqual([
      'Matches',
      'Matches',
    ]);
  });

  /*
   * The real disagreement in this case, and not one invented for the set: the
   * register holds 0.0309 ha — 309 m² — and the engineer's own report on the
   * same house states 500.0 m² by the documents.
   */
  it('states both sides of a difference rather than judging it', async () => {
    // act
    const { body } = await lookup({
      ...BUZOVNA,
      attributes: [{ name: 'plotArea', value: '500,0 m²' }],
    });

    // assert
    expect(body.attributes[0]).toMatchObject({
      match: 'Differs',
      recorded: '0.0309 ha',
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
      ...BUZOVNA,
      attributes: [{ name: 'plotArea', value: '500,0 m²' }],
    });

    // assert
    expect(body).not.toHaveProperty('valid');
    expect(body.outcome).toBe('Found');
  });

  it('is silent about a field its record does not carry', async () => {
    // act — the state register extract has no cadastral number column
    const { body } = await lookup({
      ...ZABRAT,
      attributes: [{ name: 'cadastralNumber', value: '40-12-345-67' }],
    });

    // assert
    expect(body.attributes[0]?.match).toBe('NotRecorded');
  });
});

describe('what it says about the papers it was asked about', () => {
  const PAPERS = [
    { name: 'Ərizə', type: 'application' },
    { name: 'Sərəncam çıxarışı', type: 'disposal_order' },
    { name: 'Arayış', type: 'archive_certificate' },
  ];

  it('says the archive holds each of them, and where the file is', async () => {
    // act
    const { body } = await lookup({ ...ZABRAT, documents: PAPERS });

    // assert
    expect(body.documents.map(document => document.holding)).toEqual([
      'Held',
      'Held',
      'Held',
    ]);
    expect(body.documents[0]?.location).toEqual({
      folder: '246',
      pages: '01-dən 44',
    });
  });

  it("hands the caller's own type key back untouched", async () => {
    // act
    const { body } = await lookup({ ...ZABRAT, documents: PAPERS });

    // assert
    expect(body.documents.map(document => document.type)).toEqual([
      'application',
      'disposal_order',
      'archive_certificate',
    ]);
  });

  /*
   * Not `NotHeld`. The presence registers are kept per settlement and their
   * columns differ, so a kind of paper that area's register never had a column
   * for is silence — and reporting it as missing would make a column nobody
   * ever kept look like a paper nobody ever filed.
   */
  it('is silent about a kind of paper its register never had a column for', async () => {
    // act
    const { body } = await lookup({
      ...ZABRAT,
      documents: [{ name: 'Vərəsəlik şəhadətnaməsi', type: 'inheritance' }],
    });

    // assert
    expect(body.documents[0]?.holding).toBe('Unknown');
  });

  it('has nothing to say about papers when it found no record', async () => {
    // act
    const { body } = await lookup({
      address: 'Bakı şəhəri, Nizami rayonu, Yeni küçə, ev 1',
      attributes: [],
      documents: PAPERS,
    });

    // assert
    expect(body.documents).toEqual([]);
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
