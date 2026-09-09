import { beforeAll, describe, expect, inject, it } from 'vitest';

import { ApiError, RestClient } from '@cadastre/api-client';
import { DEFAULT_SEARCH_THRESHOLD } from '@cadastre/api-contracts/registry';
import { ErrorBodySchema } from '@cadastre/api-contracts/shared';

let baseUrl: string;
let api: RestClient;

beforeAll(() => {
  baseUrl = inject('baseUrl');
  api = new RestClient(baseUrl);
});

/*
 * The archive searched, reached at this system's own origin.
 *
 * The third door onto the register's contract, and what the set guards is what
 * it guarded for the other two: the route is mounted under the prefix main.ts
 * sets, the body is refused by the contract's own schema before the register is
 * ever called, the register's answer travels back whole — the confidences, the
 * sources and the disagreements — and a refusal comes out in the one published
 * error shape.
 *
 * The register answering is `apps/registry-stub` on its own database, started
 * by the harness. A fake bound to the gateway's port would agree with the
 * gateway by construction and prove nothing about the crossing.
 */
describe('POST /api/registry/search', () => {
  it('searches the archive by a name the lookup could not have found', async () => {
    // act — no address at all: the lookup takes one and takes nothing else
    const { status, body } = await api.registry.search({
      ownerName: 'Rusadze Vera Vladimirovna',
    });

    // assert — 200 and not 201: a search is a question, and creates nothing
    expect(status).toBe(200);
    expect(
      body.matches.some(
        match => match.record.registerNo === '005013055966-10301',
      ),
    ).toBe(true);
    // Left unsaid by the caller, so the contract's own default answered.
    expect(body.threshold).toBe(DEFAULT_SEARCH_THRESHOLD);
  });

  /*
   * Two sources answering for one house and disagreeing about who holds it.
   * It is the answer, not a failure, and a route that flattened it would tell
   * the operator the archive is of one mind about a case it is not.
   */
  it('carries the sources and their disagreement through whole', async () => {
    // act
    const { body } = await api.registry.search({
      address:
        'Bakı şəhəri, Xəzər rayonu, Hövsan qəsəbəsi, Nəsimi küçəsi, ev 4',
    });

    // assert
    expect(body.sources).toEqual(
      expect.arrayContaining(['Hövsan:təhvil verilən', 'Hövsan:qəbul edilən']),
    );
    expect(body.disagreements.some(one => one.field === 'ownerName')).toBe(
      true,
    );
    expect(
      body.matches
        .filter(match => match.source.register === 'Hövsan')
        .every(match => match.disputed),
    ).toBe(true);
  });

  /*
   * Refused here, by the contract's own schema, and not forwarded for the
   * register to refuse: a caller gets one answer to a malformed body wherever
   * it sends one.
   */
  it('refuses a search that names no criterion', async () => {
    // act
    const failure = await api.registry
      .searchRaw({ threshold: 0.5 })
      .catch((error: unknown) => error as ApiError);

    // assert
    expect((failure as ApiError).status).toBe(400);
    expect((failure as ApiError).body.code).toBe('VALIDATION_FAILED');
  });

  it('refuses a body that is not the request at all, in the published shape', async () => {
    // act
    const response = await fetch(`${baseUrl}/api/registry/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ owner: 'Rusadze' }),
    });
    const body: unknown = await response.json();

    // assert
    expect(response.status).toBe(400);
    const parsed = ErrorBodySchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.code).toBe('VALIDATION_FAILED');
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
