import { beforeAll, describe, expect, inject, it } from 'vitest';

import {
  ArchiveSearchResponseSchema,
  bandOf,
  type ArchiveMatchDto,
  type ArchiveSearchRequestInput,
  type ArchiveSearchResponse,
} from '@cadastre/api-contracts/registry';

let baseUrl: string;

beforeAll(() => {
  baseUrl = inject('baseUrl');
});

async function search(request: ArchiveSearchRequestInput): Promise<{
  status: number;
  body: ArchiveSearchResponse;
}> {
  const response = await fetch(`${baseUrl}/api/registry/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body: unknown = await response.json();

  // Parsed by the published schema and not cast: what this set is for is the
  // shape on the wire.
  return {
    status: response.status,
    body: ArchiveSearchResponseSchema.parse(body),
  };
}

/**
 * The record the search was after, out of everything else the register holds.
 *
 * By register number and never by position: this set shares one database with
 * the import set, which loads the archive's own workbooks into it, so a search
 * that is meant to find a seeded case has to find it among however many records
 * arrived before it rather than expect to be the only answer.
 */
function offered(
  body: ArchiveSearchResponse,
  registerNo: string,
): ArchiveMatchDto | undefined {
  return body.matches.find(match => match.record.registerNo === registerNo);
}

/*
 * The archive searched over HTTP, against the register's own database.
 *
 * What it guards is the half of the search that a unit spec cannot see: that
 * the criteria reach the database as queries at all — a name and a cadastral
 * number are not the address the lookup narrows by — that the records come back
 * with the source they were read out of, and that two sources contradicting
 * each other survives the whole way to the wire.
 */
describe('POST /api/registry/search', () => {
  it('finds a seeded case by the name of its right holder alone', async () => {
    // act — no address at all, which is everything the lookup cannot do
    const { status, body } = await search({
      ownerName: 'Rusadze Vera Vladimirovna',
    });

    // assert — 200 and not 201: a search is a question, and creates nothing
    expect(status).toBe(200);
    const found = offered(body, '005013055966-10301');
    expect(found).toBeDefined();
    expect(found?.confidence).toBe(1);
    expect(found?.criteria[0]).toMatchObject({
      criterion: 'ownerName',
      recorded: 'Rusadze Vera Vladimirovna',
    });
  });

  // The one seeded record that carries a cadastral number at all.
  it('finds a case by its cadastral number, typed as far as it is known', async () => {
    // act
    const { body } = await search({ cadastralNumber: 'AZ-CAD-1024' });

    // assert
    const found = offered(body, '3-00219');
    expect(found).toBeDefined();
    // Part of a reference is worth how much of it was given, and never all of
    // it: the register does not know what the rest of it says.
    expect(found?.confidence).toBeLessThan(1);
    expect(found?.confidence).toBeGreaterThanOrEqual(body.threshold);
  });

  /*
   * The record written in the Azerbaijani legacy Cyrillic code page, searched
   * for in Latin. The same table the lookup reads it with, reached through the
   * search's own criteria — and the answer names the register it came out of,
   * which is the whole of what a source is for.
   */
  it('finds a record written in the legacy code page, and names its source', async () => {
    // act
    const { body } = await search({
      ownerName: 'Əzizov Arif Mövlud oğlu',
      address: 'Qusar şəhəri, H.Z.Tağıyev küçəsi',
    });

    // assert
    const found = offered(body, '2257');
    expect(found).toBeDefined();
    expect(found?.source.name).toBe('пасбаза');
    expect(body.sources).toContain('пасбаза');
  });

  /*
   * The Hövsan handover pair: one house, entered by two territorial offices,
   * with the holder of record changed between them (ADR-0010). The register
   * does not choose — it says the two sources differ, quotes both, and somebody
   * who can open the folder decides.
   */
  it('says when two sources answer for one property and disagree about it', async () => {
    // act
    const { body } = await search({
      address: 'Bakı şəhəri, Xəzər rayonu, Hövsan qəsəbəsi, Nəsimi küçəsi, ev 4', // prettier-ignore
    });

    // assert
    const absheron = offered(body, '308011000692');
    const baku = offered(body, '006011006603');
    expect(absheron?.source.name).toBe('Hövsan:təhvil verilən');
    expect(baku?.source.name).toBe('Hövsan:qəbul edilən');
    expect(absheron?.disputed).toBe(true);
    expect(baku?.disputed).toBe(true);

    const owner = body.disagreements.find(one => one.field === 'ownerName');
    expect(owner?.statements).toEqual(
      expect.arrayContaining([
        { source: 'Hövsan:təhvil verilən', value: 'Məmmədov Elçin Vaqif oğlu' },
        { source: 'Hövsan:qəbul edilən', value: 'Məmmədova Sevil Elçin qızı' },
      ]),
    );
  });

  /*
   * The threshold is the caller's. An operator hunting a case they know is in
   * there reads the weak rows themselves; one sweeping for duplicates does not
   * want to see them, and the register has no opinion about which of the two is
   * asking (ADR-0009).
   */
  it('answers the threshold it was given, and says which one that was', async () => {
    // arrange — a surname on its own, which is weak evidence by construction
    const surname = { ownerName: 'Rusadze' };

    // act
    const wide = await search({ ...surname, threshold: 0.4 });
    const narrow = await search({ ...surname, threshold: 0.95 });

    // assert
    expect(wide.body.matched).toBeGreaterThan(0);
    expect(offered(narrow.body, '005013055966-10301')).toBeUndefined();
    expect(narrow.body.threshold).toBe(0.95);
    expect(wide.body.threshold).toBe(0.4);
  });

  it('answers with no more than the page it was asked for, and says how many there were', async () => {
    // act
    const { body } = await search({ address: 'Bakı şəhəri', limit: 1 });

    // assert
    expect(body.matches).toHaveLength(1);
    expect(body.matched).toBeGreaterThan(1);
    expect(body.considered).toBeGreaterThanOrEqual(body.matched);
  });

  /*
   * The number and not a word, and every band drawn by the caller at the floors
   * the contract names — which is what `bandOf` is, and it is published so two
   * screens cannot band one answer differently.
   */
  it('answers with a confidence and never with a band or a verdict', async () => {
    // act
    const { body } = await search({ ownerName: 'Rusadze Vera Vladimirovna' });

    // assert
    const found = offered(body, '005013055966-10301');
    expect(found).not.toHaveProperty('band');
    expect(found).not.toHaveProperty('valid');
    expect(bandOf(found?.confidence ?? 0)).toBe('High');
  });

  /*
   * A search with no criterion is a request for the whole archive, and the
   * archive is not a list. Refused by the contract's own schema at the edge,
   * exactly as a malformed lookup is.
   */
  it('refuses a search that names no criterion', async () => {
    // act
    const response = await fetch(`${baseUrl}/api/registry/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ threshold: 0.5 }),
    });

    // assert
    expect(response.status).toBe(400);
  });

  it('refuses a threshold that is not a confidence', async () => {
    // act
    const response = await fetch(`${baseUrl}/api/registry/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ownerName: 'Rusadze', threshold: 4 }),
    });

    // assert
    expect(response.status).toBe(400);
  });

  it('mounts the route under the prefix main.ts sets, and only there', async () => {
    // act
    const bare = await fetch(`${baseUrl}/registry/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ownerName: 'Rusadze Vera Vladimirovna' }),
    });

    // assert
    expect(bare.status).toBe(404);
  });
});
