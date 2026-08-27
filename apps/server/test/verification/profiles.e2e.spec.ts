import { beforeAll, describe, expect, inject, it } from 'vitest';

import { RestClient } from '@cadastre/api-client';

let api: RestClient;

beforeAll(() => {
  api = new RestClient(inject('baseUrl'));
});

/*
 * The narrowest useful API spec: the route is mounted under the prefix main.ts
 * sets, and what comes back parses as the contract the browser imports. The
 * client parses every body with the contract's own schema, so "the shape on the
 * wire drifted from the published language" fails here and nowhere else.
 */
describe('GET /api/profiles', () => {
  it('publishes the profiles a submission can be judged against', async () => {
    // act
    const { status, body } = await api.profiles.findMany();

    // assert
    expect(status).toBe(200);
    expect(body.map(profile => profile.key)).toContain('cadastre');
  });

  it('describes each document type the profile requires', async () => {
    // act
    const { body } = await api.profiles.findMany();
    const cadastre = body.find(profile => profile.key === 'cadastre');

    // assert
    expect(cadastre).toBeDefined();
    expect(cadastre!.documentTypes.length).toBeGreaterThan(0);
    expect(cadastre!.documentTypes.every(type => type.key.length > 0)).toBe(
      true,
    );
  });
});
