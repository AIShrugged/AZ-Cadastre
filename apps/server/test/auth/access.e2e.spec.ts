import { beforeAll, describe, expect, inject, it } from 'vitest';

import { RestClient, type ApiResponse } from '@cadastre/api-client';
import type {
  FileInput,
  PackageDto,
} from '@cadastre/api-contracts/verification';

import { asNewUser, asOperator } from '../harness/sign-in.js';

let baseUrl: string;
let operator: RestClient;
let applicant: RestClient;
let anotherApplicant: RestClient;

beforeAll(async () => {
  baseUrl = inject('baseUrl');
  operator = await asOperator(baseUrl);
  applicant = await asNewUser(baseUrl);
  anotherApplicant = await asNewUser(baseUrl);
});

/** Files as the browser prepares them: presign each, then send the keys on. */
async function presigned(
  api: RestClient,
  names: readonly string[],
): Promise<FileInput[]> {
  return Promise.all(
    names.map(async name => {
      const { body } = await api.documents.presign({
        filename: name,
        contentType: 'application/pdf',
        size: 2048,
      });

      return {
        originalFilename: name,
        contentType: 'application/pdf',
        storageKey: body.key,
      };
    }),
  );
}

async function submit(api: RestClient): Promise<PackageDto> {
  const { body } = await api.packages.create({
    profileKey: 'cadastre',
    files: await presigned(api, ['technical-passport.pdf']),
  });

  return body;
}

/*
 * The table of who may call what, one case per row (ADR-0029).
 *
 * Over HTTP and against the real guards, because that is where the rule lives:
 * a unit test of a guard proves the guard, and what this set is for is that the
 * guard is actually in front of the route.
 */
describe('with no session at all', () => {
  const anonymous = (): RestClient => new RestClient(baseUrl);

  it.each([
    ['GET /packages', (api: RestClient) => api.packages.findMany()],
    ['GET /packages/overview', (api: RestClient) => api.packages.overview()],
    [
      'GET /packages/:id',
      (api: RestClient) =>
        api.packages.findOne('00000000-0000-4000-8000-000000000000'),
    ],
    ['GET /profiles', (api: RestClient) => api.profiles.findMany()],
    ['GET /profiles/suggestion', (api: RestClient) => api.profiles.suggest()],
    ['GET /registry/summary', (api: RestClient) => api.registry.summary()],
    [
      'POST /documents/presign',
      (api: RestClient) =>
        api.documents.presign({
          filename: 'a.pdf',
          contentType: 'application/pdf',
          size: 10,
        }),
    ],
    [
      'POST /packages',
      (api: RestClient) =>
        api.packages.createRaw({ profileKey: 'cadastre', files: [] }),
    ],
    [
      'POST /addresses/lookup',
      (api: RestClient) =>
        api.addresses.lookupRaw({
          address: 'anywhere',
          attributes: [],
          documents: [],
        }),
    ],
  ])('refuses %s with 401', async (_route, call) => {
    await expect(call(anonymous())).rejects.toMatchObject({
      status: 401,
      body: { code: 'UNAUTHORISED' },
    });
  });

  it('refuses before validating the body, so a 401 is never a 400', async () => {
    // The body is nonsense. A session is still the first question asked, which
    // is what keeps an unauthenticated caller from learning the shape of a
    // request by being told what is wrong with theirs.
    await expect(
      anonymous().packages.createRaw({ nonsense: true }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('an applicant', () => {
  it('may open a package, and it is theirs', async () => {
    const submitted = await submit(applicant);

    const { body } = await applicant.packages.findOne(submitted.id);

    expect(body.id).toBe(submitted.id);
  });

  it('sees only their own submissions in the list', async () => {
    const mine = await submit(applicant);
    const theirs = await submit(anotherApplicant);

    const { body } = await applicant.packages.findMany({ limit: 100 });
    const ids = body.items.map(item => item.id);

    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
  });

  it('gets a 404 and never a 403 for somebody else’s package', async () => {
    const theirs = await submit(anotherApplicant);

    await expect(applicant.packages.findOne(theirs.id)).rejects.toMatchObject({
      status: 404,
      body: { code: 'PACKAGE_NOT_FOUND' },
    });
  });

  it('cannot add files to somebody else’s package', async () => {
    const theirs = await submit(anotherApplicant);
    const files = await presigned(applicant, ['another.pdf']);

    await expect(
      applicant.packages.addFiles(theirs.id, { files }),
    ).rejects.toMatchObject({
      status: 404,
      body: { code: 'PACKAGE_NOT_FOUND' },
    });
  });

  it('cannot supply a document for somebody else’s package', async () => {
    const theirs = await submit(anotherApplicant);
    const [file] = await presigned(applicant, ['technical-passport.pdf']);

    await expect(
      applicant.packages.supplyDocument(theirs.id, {
        file: file as FileInput,
        expectedType: 'technical_passport',
      }),
    ).rejects.toMatchObject({
      status: 404,
      body: { code: 'PACKAGE_NOT_FOUND' },
    });
  });

  it.each([
    [
      'the overview',
      (api: RestClient): Promise<ApiResponse<unknown>> =>
        api.packages.overview(),
    ],
    [
      'the archive search',
      (api: RestClient): Promise<ApiResponse<unknown>> =>
        api.registry.search({ address: 'Bakı' }),
    ],
    [
      'the address lookup',
      (api: RestClient): Promise<ApiResponse<unknown>> =>
        api.addresses.lookupRaw({
          address: 'Bakı',
          attributes: [],
          documents: [],
        }),
    ],
    [
      'what the register holds',
      (api: RestClient): Promise<ApiResponse<unknown>> =>
        api.registry.summary(),
    ],
  ])('is refused %s with 403', async (_route, call) => {
    await expect(call(applicant)).rejects.toMatchObject({
      status: 403,
      body: { code: 'FORBIDDEN' },
    });
  });

  it('is refused the archive-search approval with 403, even on their own package', async () => {
    const mine = await submit(applicant);

    await expect(
      applicant.packages.approveArchiveSearch(mine.id, {
        summary: 'Looks right to me',
      }),
    ).rejects.toMatchObject({ status: 403, body: { code: 'FORBIDDEN' } });
  });

  it('may read the profiles and ask for a suggestion', async () => {
    await expect(applicant.profiles.findMany()).resolves.toMatchObject({
      status: 200,
    });
    await expect(applicant.profiles.suggest()).resolves.toMatchObject({
      status: 200,
    });
  });
});

describe('the office', () => {
  it('sees an applicant’s submission in the register of cases', async () => {
    const theirs = await submit(applicant);

    const { body } = await operator.packages.findOne(theirs.id);

    expect(body.id).toBe(theirs.id);
  });

  it('may read the overview and the archive', async () => {
    await expect(operator.packages.overview()).resolves.toMatchObject({
      status: 200,
    });
    await expect(operator.registry.summary()).resolves.toMatchObject({
      status: 200,
    });
  });
});
