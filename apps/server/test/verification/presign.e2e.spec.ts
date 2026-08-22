import { beforeAll, describe, expect, inject, it } from 'vitest';

import { ApiError, RestClient } from '@cadastre/api-client';

const MAX_BYTES = 50 * 1024 * 1024;

let api: RestClient;

beforeAll(() => {
  api = new RestClient(inject('baseUrl'));
});

describe('POST /api/documents/presign', () => {
  it('signs a URL the browser can PUT the file to', async () => {
    // act
    const { status, body } = await api.documents.presign({
      filename: 'erize-qeydiyyat.pdf',
      contentType: 'application/pdf',
      size: 1024,
    });

    // assert
    expect(status).toBe(201);
    expect(body.key).toContain('erize-qeydiyyat.pdf');
    expect(body.expiresIn).toBeGreaterThan(0);

    /*
     * A path, not an absolute URL, and deliberately so: the dev proxy serves
     * the PUT from the web app's own origin instead of sending the browser
     * across into storage. What has to survive is the signature — strip it and
     * the upload is refused by the bucket, which no other set would notice.
     */
    expect(body.url.startsWith('/')).toBe(true);
    expect(body.url).toContain('X-Amz-Signature=');
    expect(body.url).toContain('X-Amz-Expires=');
  });

  /*
   * The gateway's filter maps a domain code to a status, and that table is
   * part of the contract: the client tells a file that is too large from a file
   * of the wrong kind by the status, before it reads the body. Nothing below
   * this set can see that mapping — the context only throws the exception.
   */
  it('answers 413 with FILE_TOO_LARGE for a file over the limit', async () => {
    // act / assert
    const failure = await api.documents
      .presign({
        filename: 'huge.pdf',
        contentType: 'application/pdf',
        size: MAX_BYTES + 1,
      })
      .catch((error: unknown) => error as ApiError);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(413);
    expect((failure as ApiError).body.code).toBe('FILE_TOO_LARGE');
  });

  it('answers 422 with UNSUPPORTED_CONTENT_TYPE for a kind the pipeline cannot read', async () => {
    // act / assert
    const failure = await api.documents
      .presign({
        filename: 'notes.txt',
        contentType: 'text/plain',
        size: 1024,
      })
      .catch((error: unknown) => error as ApiError);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(422);
    expect((failure as ApiError).body.code).toBe('UNSUPPORTED_CONTENT_TYPE');
  });

  /*
   * The global pipe from main.ts, which no other set installs: a body that does
   * not satisfy the contract's schema is refused at the edge, before any
   * handler is asked.
   */
  it('refuses a body the published schema does not accept', async () => {
    // act / assert
    const failure = await api.documents
      .presignRaw({ filename: 'x.pdf', contentType: 'application/pdf' })
      .catch((error: unknown) => error as ApiError);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(400);
    /*
     * The published language has exactly one error shape, and the web client
     * branches on `code` and nothing else. A refusal the framework raises has
     * to carry one too, or the client can only say "something went wrong".
     */
    expect((failure as ApiError).body.code).toBe('VALIDATION_FAILED');
  });
});
