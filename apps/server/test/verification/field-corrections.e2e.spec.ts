import { beforeAll, describe, expect, inject, it } from 'vitest';

import { ApiError, type RestClient } from '@cadastre/api-client';
import type { FileInput } from '@cadastre/api-contracts/verification';

import { asOperator } from '../harness/sign-in.js';

let api: RestClient;

/*
 * The route an operator corrects a field through, over HTTP (ADR-0033).
 *
 * What this set can reach is the edge: the schema in front of the handler, the
 * refusals and the statuses they come back as. It cannot reach a *corrected
 * value*, because no bytes are ever uploaded here — the pipeline finds nothing
 * to split, so these packages hold no documents to correct a field on. What a
 * correction does to a package is the integration set's
 * (`operator-corrections.int.spec.ts`), against the real database and the real
 * run.
 *
 * Signed in as the office, because the route is the office's own; who may call
 * it and who gets a 403 is the table in `auth/access.e2e.spec.ts`.
 */
beforeAll(async () => {
  api = await asOperator(inject('baseUrl'));
});

const MISSING = '00000000-0000-4000-8000-000000000000';

async function presigned(names: readonly string[]): Promise<FileInput[]> {
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

async function aPackage(): Promise<string> {
  const { body } = await api.packages.create({
    profileKey: 'cadastre',
    files: await presigned(['sexsiyyet-vesiqe.pdf']),
  });

  return body.id;
}

const refusalOf = async (call: Promise<unknown>): Promise<ApiError> =>
  call.then(
    () => {
      throw new Error('that call was supposed to be refused');
    },
    (error: unknown) => error as ApiError,
  );

describe('the route an operator corrects a field through', () => {
  it('answers PACKAGE_NOT_FOUND for a package nobody submitted', async () => {
    // act
    const failure = await refusalOf(
      api.packages.editDocumentFields(MISSING, MISSING, {
        fields: [{ name: 'document_no', value: 'AZE7654321' }],
      }),
    );

    // assert
    expect(failure.body.statusCode).toBe(404);
    expect(failure.body.code).toBe('PACKAGE_NOT_FOUND');
  });

  it('answers DOCUMENT_NOT_IN_PACKAGE for a document this package has not got', async () => {
    // arrange
    const id = await aPackage();

    // act
    const failure = await refusalOf(
      api.packages.editDocumentFields(id, MISSING, {
        fields: [{ name: 'document_no', value: 'AZE7654321' }],
      }),
    );

    // assert
    expect(failure.body.statusCode).toBe(404);
    expect(failure.body.code).toBe('DOCUMENT_NOT_IN_PACKAGE');
  });

  /*
   * The body is the whole of what this takes, and the schema is what says so —
   * every one of these is a 400 from the global pipe and never a call into the
   * context (ADR-0033).
   */
  it.each([
    ['no entries at all', { fields: [] }],
    ['a blank value', { fields: [{ name: 'document_no', value: '   ' }] }],
    ['no name', { fields: [{ value: 'AZE7654321' }] }],
    [
      'one key twice',
      {
        fields: [
          { name: 'document_no', value: 'AZE7654321' },
          { name: 'document_no', value: 'AZE1234567' },
        ],
      },
    ],
    ['no fields at all', {}],
  ])('refuses %s before any handler is asked', async (_case, body) => {
    // arrange
    const id = await aPackage();

    // act
    const failure = await refusalOf(
      api.packages.editDocumentFieldsRaw(id, MISSING, body),
    );

    // assert
    expect(failure.body.statusCode).toBe(400);
    expect(failure.body.code).toBe('VALIDATION_FAILED');
  });
});
