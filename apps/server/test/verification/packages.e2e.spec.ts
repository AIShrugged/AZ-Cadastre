import { beforeAll, describe, expect, inject, it } from 'vitest';

import { ApiError, RestClient } from '@cadastre/api-client';
import type { PackageDto } from '@cadastre/api-contracts/verification';

let api: RestClient;

beforeAll(() => {
  api = new RestClient(inject('baseUrl'));
});

/** A submission as the browser makes it: presign each file, then send the keys. */
async function submit(names: readonly string[]): Promise<PackageDto> {
  const files = await Promise.all(
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

  const { body } = await api.packages.create({ profileKey: 'cadastre', files });
  return body;
}

/** The run starts on its own, so a spec that reads a fresh package races it. */
async function settled(id: string, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { body } = await api.packages.findOne(id);
    if (body.status === 'Completed' || body.status === 'Failed') return;
    if (Date.now() > deadline) {
      throw new Error(`package ${id} was still ${body.status}`);
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}

describe('the submission round trip over HTTP', () => {
  it('takes a package in and gives back the summary the list shows', async () => {
    // arrange / act
    const created = await submit([
      'erize-qeydiyyat.pdf',
      'sexsiyyet-vesiqe.pdf',
    ]);

    // assert
    expect(created.id).toBeTruthy();
    expect(created.profileKey).toBe('cadastre');
    expect(created.filesCount).toBe(2);
  });

  it('lists the package it accepted', async () => {
    // arrange
    const created = await submit(['erize-qeydiyyat.pdf']);

    // act
    const { status, body } = await api.packages.findMany();

    // assert
    expect(status).toBe(200);
    expect(body.map(summary => summary.id)).toContain(created.id);
  });

  it('reports what the run found, once it has run', async () => {
    // arrange
    const created = await submit([
      'erize-qeydiyyat.pdf',
      'sexsiyyet-vesiqe.pdf',
    ]);

    // act
    await settled(created.id);
    const { body } = await api.packages.findOne(created.id);

    // assert — the bytes were never uploaded, so the run has little to say;
    // that it says it, in the published shape, is the point
    expect(body.status).toBe('Completed');
    expect(body.report).not.toBeNull();
    expect(body.files).toHaveLength(2);
  });
});

describe('what the API refuses', () => {
  /*
   * PACKAGE_NOT_FOUND is an ApplicationException carrying its own status. The
   * filter passes it through rather than mapping it, and this is the only place
   * that is checked — a client tells "no such package" from "the server broke"
   * by this number.
   */
  it('answers 404 with PACKAGE_NOT_FOUND for an id nobody submitted', async () => {
    // act / assert
    const failure = await api.packages
      .findOne('00000000-0000-4000-8000-000000000000')
      .catch((error: unknown) => error as ApiError);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(404);
    expect((failure as ApiError).body.code).toBe('PACKAGE_NOT_FOUND');
  });

  it('refuses a submission whose body the published schema does not accept', async () => {
    // act / assert
    const failure = await api.packages
      .createRaw({ files: [] })
      .catch((error: unknown) => error as ApiError);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(400);
  });
});
