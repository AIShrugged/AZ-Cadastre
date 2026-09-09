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

  // What an intake screen offers the operator to declare the case on. Always
  // papers the profile itself reads, so a picker built off this cannot offer
  // one no run would ever act on.
  it('names the grounds a right can be claimed on, out of its own document types', async () => {
    // act
    const { body } = await api.profiles.findMany();
    const cadastre = body.find(profile => profile.key === 'cadastre');

    // assert
    expect(cadastre!.grounds).toContain('disposal_order');
    const types = cadastre!.documentTypes.map(type => type.key);
    expect(cadastre!.grounds.every(ground => types.includes(ground))).toBe(
      true,
    );
  });
});

/*
 * A recommendation and nothing more. Nothing here narrows what `POST /packages`
 * takes: the profile a package is filed under is whatever the operator sent.
 */
describe('GET /api/profiles/suggestion', () => {
  it('proposes the profile that registers a right founded on the declared ground', async () => {
    // act
    const { status, body } = await api.profiles.suggest({
      legalBasis: 'disposal_order',
      builtYear: 1998,
    });

    // assert
    expect(status).toBe(200);
    expect(body.profileKey).toBe('cadastre');
  });

  // A suggestion an operator cannot argue with is one they can only obey or
  // distrust, so it comes back with its reasoning, criterion by criterion.
  it('says what it decided on, whatever each criterion settled', async () => {
    // act
    const { body } = await api.profiles.suggest({
      legalBasis: 'disposal_order',
      builtYear: 1998,
    });

    // assert
    expect(body.reasons.map(reason => reason.criterion)).toEqual([
      'legalBasis',
      'builtYear',
    ]);
    expect(body.reasons[0]?.note).toContain('disposal_order');
  });

  it('answers with no profile, and why, for a ground nothing registers', async () => {
    // act
    const { body } = await api.profiles.suggest({
      legalBasis: 'purchase_contract',
    });

    // assert
    expect(body.profileKey).toBeNull();
    expect(body.reasons[0]?.note).toContain('purchase_contract');
  });

  // The screen asks while the operator is still typing, and "nothing declared
  // yet" is a question with an answer rather than a malformed request.
  it('answers with no profile where nothing has been declared yet', async () => {
    // act
    const { status, body } = await api.profiles.suggest();

    // assert
    expect(status).toBe(200);
    expect(body.profileKey).toBeNull();
  });

  it('refuses a year no paper of these could be dated by, at the edge', async () => {
    // act, assert
    await expect(
      api.profiles.suggestRaw('?builtYear=3000'),
    ).rejects.toMatchObject({ status: 400 });
  });
});
