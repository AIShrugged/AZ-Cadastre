import { beforeAll, describe, expect, inject, it } from 'vitest';

import { ApiError, RestClient } from '@cadastre/api-client';
import { ErrorBodySchema } from '@cadastre/api-contracts/shared';

let baseUrl: string;
let api: RestClient;

beforeAll(() => {
  baseUrl = inject('baseUrl');
  api = new RestClient(baseUrl);
});

/*
 * The archive search, reached at this system's own origin.
 *
 * Until this route existed the browser called the register directly, through a
 * proxy of its own, at an address with no authentication in front of it
 * (TECH_DEBT §10). What the set guards is that the door is really open: the
 * route is mounted under the prefix main.ts sets, the body is refused by the
 * contract's own schema before the register is ever called, the register's
 * three answers travel back whole, and a refusal comes out in the one published
 * error shape.
 *
 * The register answering is `apps/registry-stub` on its own database, started
 * by the harness — a real process, because a fake client bound to the gateway's
 * port would agree with the gateway by construction and prove nothing about the
 * crossing.
 */

// The confirmed case, written the way a submission writes it: abbreviated, out
// of order, without the postal code the register's own spelling starts with.
const ZABRAT = 'Sabunçu r., Zabrat qəs., Qazı Məhəmmədov küç., giriş 95A';

describe('POST /api/addresses/lookup', () => {
  it('hands back the record the register holds under the address', async () => {
    // act
    const { status, body } = await api.addresses.lookup({
      address: ZABRAT,
      attributes: [],
      documents: [],
    });

    // assert — 200 and not 201: a lookup is a question, and creates nothing
    expect(status).toBe(200);
    expect(body.outcome).toBe('Found');
    expect(body.record?.registerNo).toBe('005013055966-10301');
  });

  it('says so when the archive holds nothing under the address', async () => {
    // act
    const { body } = await api.addresses.lookup({
      address: 'Bakı şəhəri, Nizami rayonu, Yeni küçə, ev 1',
      attributes: [],
      documents: [],
    });

    // assert
    expect(body).toMatchObject({ outcome: 'NotFound', record: null });
  });

  /*
   * Two records for one address is an answer and not a failure, and it must
   * survive the crossing as one: the screen shows the operator that the archive
   * cannot choose, and a route that flattened it to `NotFound` would tell them
   * the property is unregistered.
   */
  it('carries an ambiguous answer through as an answer', async () => {
    // act
    const { body } = await api.addresses.lookup({
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

  /*
   * Refused here, by the contract's own schema, and not forwarded for the
   * register to refuse: the gateway validates with `AddressLookupRequestSchema`
   * exactly as the verification routes validate with theirs, so a caller gets
   * one answer to a malformed body wherever it sends one.
   */
  it('refuses a body the published schema does not accept', async () => {
    // act — an address is required and an empty one is not an address
    const failure = await api.addresses
      .lookupRaw({ address: '   ' })
      .catch((error: unknown) => error as ApiError);

    // assert
    expect((failure as ApiError).status).toBe(400);
    expect((failure as ApiError).body.code).toBe('VALIDATION_FAILED');
  });

  it('refuses a body that is not the request at all, in the published shape', async () => {
    // act
    const response = await fetch(`${baseUrl}/api/addresses/lookup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ street: 'Nəsimi küçəsi' }),
    });
    const body: unknown = await response.json();

    // assert
    expect(response.status).toBe(400);
    const parsed = ErrorBodySchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.code).toBe('VALIDATION_FAILED');
  });

  it('mounts the route under the prefix main.ts sets, and only there', async () => {
    // act — the same path without the prefix must not answer
    const bare = await fetch(`${baseUrl}/addresses/lookup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: ZABRAT }),
    });

    // assert
    expect(bare.status).toBe(404);
  });
});
