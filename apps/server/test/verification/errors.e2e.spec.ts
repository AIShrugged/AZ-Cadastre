import { beforeAll, describe, expect, inject, it } from 'vitest';

import { ApiError, type RestClient } from '@cadastre/api-client';
import { ErrorBodySchema } from '@cadastre/api-contracts/shared';

import { asOperator, sessionHeader } from '../harness/sign-in.js';

let baseUrl: string;
let api: RestClient;

/*
 * Signed in as the office, because everything under `/api` needs a session now
 * and the archive is the office's to search (ADR-0029). The cases about who may
 * call what are in `auth/access.e2e.spec.ts`; this file is about the route.
 */
beforeAll(async () => {
  baseUrl = inject('baseUrl');
  api = await asOperator(baseUrl);
});

/*
 * One error shape, whoever refused. `@cadastre/api-contracts/shared` publishes
 * `ErrorBody`, and the web client parses every failure with it and answers
 * `null` when the parse fails — so a refusal in another shape does not crash
 * the UI, it silently loses its reason. Nothing below this set can see that.
 */
describe('every refusal the API itself makes comes back in the published shape', () => {
  it('renders a domain refusal as a code and a status', async () => {
    // act
    const failure = await api.packages
      .findOne('00000000-0000-4000-8000-000000000000')
      .catch((error: unknown) => error as ApiError);

    // assert — the code names the rule and outlives any rewording of the text
    expect((failure as ApiError).body.code).toBe('PACKAGE_NOT_FOUND');
    expect((failure as ApiError).body.statusCode).toBe(404);
  });

  it('renders a refusal the framework raises in the same shape', async () => {
    // act — rejected by the global pipe, before any handler is asked
    const response = await fetch(`${baseUrl}/api/documents/presign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...sessionHeader(api) },
      body: JSON.stringify({ filename: 'x.pdf' }),
    });
    const body: unknown = await response.json();

    // assert
    expect(response.status).toBe(400);
    const parsed = ErrorBodySchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.code).toBe('VALIDATION_FAILED');
  });

  it('mounts every route under the prefix main.ts sets, and only there', async () => {
    // act — the same path without the prefix must not answer
    const prefixed = await fetch(`${baseUrl}/api/profiles`, {
      headers: sessionHeader(api),
    });
    const bare = await fetch(`${baseUrl}/profiles`, {
      headers: sessionHeader(api),
    });

    // assert
    expect(prefixed.status).toBe(200);
    expect(bare.status).toBe(404);
    /*
     * The body of that 404 is deliberately not asserted: an unmatched route is
     * answered by Express before Nest's filters are reached, so it comes back
     * as an HTML error page rather than as ErrorBody. That is a real gap and it
     * is written down in TECH_DEBT (entry 6) rather than pinned here as though
     * it were intended.
     */
  });
});
