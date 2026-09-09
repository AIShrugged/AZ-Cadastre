import { beforeAll, describe, expect, inject, it } from 'vitest';

import { RestClient } from '@cadastre/api-client';

let baseUrl: string;
let api: RestClient;

beforeAll(() => {
  baseUrl = inject('baseUrl');
  api = new RestClient(baseUrl);
});

/*
 * What the archive register holds, reached at this system's own origin.
 *
 * The second area of the register's contract to get a door. Until this route
 * existed the sidebar's archive block had nothing to ask but the register's own
 * `/api/health`, round the API through a proxy at an origin with no
 * authentication in front of it (TECH_DEBT §10) — and health answers `ok` for a
 * register with an empty database exactly as it does for one holding the whole
 * archive.
 *
 * The register answering is `apps/registry-stub` on its own database, started
 * by the harness — a real process, so what this checks is the crossing and not
 * a fake agreeing with the gateway by construction.
 */
describe('GET /api/registry/summary', () => {
  it('hands back what the register holds', async () => {
    // act
    const { status, body } = await api.registry.summary();

    // assert — the seeded register holds the customer's own cases
    expect(status).toBe(200);
    expect(body.records).toBeGreaterThan(0);
    expect(body.sources).toBeGreaterThan(0);
    expect(body.loadedAt).not.toBeNull();
  });

  /*
   * The register's answer, and no wrapper of ours. `RestClient` parses it with
   * the published schema, so a gateway that reshaped anything on the way
   * through fails here rather than in a browser.
   */
  it('carries the breakdown through whole, adding up to the total', async () => {
    // act
    const { body } = await api.registry.summary();

    // assert
    expect(body.bySource.length).toBeGreaterThanOrEqual(6);
    expect(
      body.bySource.reduce((total, source) => total + source.records, 0),
    ).toBe(body.records);
    expect(body.sources).toBe(
      body.bySource.filter(source => source.records > 0).length,
    );
  });

  /*
   * Read off the wire and not through the client, which parses with the
   * published schema and would strip anything extra before a spec could see it.
   */
  it('says nothing about whether the archive is ready', async () => {
    // act
    const response = await fetch(`${baseUrl}/api/registry/summary`);
    const body = (await response.json()) as Record<string, unknown>;

    // assert — facts and no verdict: what four sources out of six means is the
    // caller's rule and not the register's (ADR-0009)
    expect(Object.keys(body).toSorted()).toEqual([
      'bySource',
      'loadedAt',
      'records',
      'sources',
    ]);
  });

  it('mounts the route under the prefix main.ts sets, and only there', async () => {
    // act — the same path without the prefix must not answer
    const bare = await fetch(`${baseUrl}/registry/summary`);

    // assert
    expect(bare.status).toBe(404);
  });
});
