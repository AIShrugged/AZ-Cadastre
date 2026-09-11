import { beforeAll, describe, expect, inject, it } from 'vitest';

import { ApiError, RestClient } from '@cadastre/api-client';
import {
  LIST_PACKAGES_MAX_LIMIT,
  ListPackagesResponseSchema,
  type DeclaredAtIntakeInput,
  type FileInput,
  type PackageDto,
} from '@cadastre/api-contracts/verification';

let api: RestClient;

beforeAll(() => {
  api = new RestClient(inject('baseUrl'));
});

/** Files as the browser prepares them: presign each, then send the keys on. */
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

/** A submission as the browser makes it. */
async function submit(
  names: readonly string[],
  declared?: DeclaredAtIntakeInput,
): Promise<PackageDto> {
  const { body } = await api.packages.create({
    profileKey: 'cadastre',
    files: await presigned(names),
    ...(declared === undefined ? {} : { declared }),
  });
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

    // assert — a page, and what page it is: the list grows with every
    // submission and is never served whole (ADR-0015)
    expect(status).toBe(200);
    expect(body.items.map(summary => summary.id)).toContain(created.id);
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
    expect(body.total).toBeGreaterThanOrEqual(body.items.length);
  });

  // What `apps/web` sends: no query string at all. The defaults are the
  // schema's, and a request that names nothing must still be a page.
  it('answers the first page when the caller asks for nothing at all', async () => {
    // arrange — so the page has something on it
    await submit(['erize-qeydiyyat.pdf']);

    // act
    const { status, body } = await api.packages.findManyRaw('');

    // assert
    const page = ListPackagesResponseSchema.parse(body);
    expect(status).toBe(200);
    expect(page.limit).toBe(20);
    expect(page.offset).toBe(0);
    expect(page.items.length).toBeLessThanOrEqual(20);
    expect(page.total).toBeGreaterThanOrEqual(1);
  });

  it('narrows the list to what the inspector typed', async () => {
    // arrange — a name no other submission in this run carries
    const created = await submit(['bina-pasportu-2026.pdf']);

    // act
    const { body } = await api.packages.findMany({
      search: 'BINA-Pasportu-2026',
    });

    // assert
    expect(body.items.map(summary => summary.id)).toEqual([created.id]);
    expect(body.total).toBe(1);
  });

  it('narrows by where the submission stands, which is not what the run found', async () => {
    // arrange
    const created = await submit(['erize-qeydiyyat.pdf']);
    await settled(created.id);

    // act — the run has nothing to read, so the envelope is short a paper
    const short = await api.packages.findMany({
      standing: 'ShortOfDocuments',
    });
    const cleared = await api.packages.findMany({ standing: 'Cleared' });

    // assert
    expect(short.body.items.map(summary => summary.id)).toContain(created.id);
    expect(cleared.body.items.map(summary => summary.id)).not.toContain(
      created.id,
    );
  });

  /*
   * The slice an inspector calls "in progress" is two standings, and it travels
   * as the parameter repeated. Over HTTP because that is where it can go wrong:
   * a query string is parsed by the server, not by the schema, and a reading
   * that kept only the last value would answer a tab of two with a list of one.
   */
  it('narrows by several standings at once, sent as the parameter repeated', async () => {
    // arrange
    const created = await submit(['erize-qeydiyyat.pdf']);
    await settled(created.id);

    // act — the run has nothing to read, so the envelope is short a paper; the
    // slice asked for is two standings it is not among and the one it is
    const slice = await api.packages.findMany({
      standing: ['Queued', 'UnderVerification', 'ShortOfDocuments'],
      limit: LIST_PACKAGES_MAX_LIMIT,
    });
    const cleared = await api.packages.findMany({
      standing: ['Cleared', 'NeedsInspector'],
      limit: LIST_PACKAGES_MAX_LIMIT,
    });

    // assert
    expect(slice.body.items.map(summary => summary.id)).toContain(created.id);
    // Any of the three and nothing else: a slice widened by one bad reading of
    // the parameter would show rows nobody asked for.
    expect(
      slice.body.items.every(summary =>
        ['Queued', 'UnderVerification', 'ShortOfDocuments'].includes(
          summary.standing,
        ),
      ),
    ).toBe(true);
    expect(cleared.body.items.map(summary => summary.id)).not.toContain(
      created.id,
    );
  });

  // A slice of one is the filter this endpoint always took, which is what makes
  // the change something no existing caller has to notice.
  it('answers a single standing the same whether it is sent alone or as a list of one', async () => {
    // arrange
    const created = await submit(['erize-qeydiyyat.pdf']);
    await settled(created.id);

    // act
    const alone = await api.packages.findManyRaw(
      `?standing=ShortOfDocuments&limit=${LIST_PACKAGES_MAX_LIMIT}`,
    );
    const asList = await api.packages.findMany({
      standing: ['ShortOfDocuments'],
      limit: LIST_PACKAGES_MAX_LIMIT,
    });

    // assert
    const page = ListPackagesResponseSchema.parse(alone.body);
    expect(page.items.map(summary => summary.id)).toContain(created.id);
    expect(asList.body.items.map(summary => summary.id)).toEqual(
      page.items.map(summary => summary.id),
    );
  });

  // One bad value among good ones is still a filter nobody named: answering the
  // good ones would silently widen the slice somebody asked for.
  it('refuses a slice in which one standing is a word nobody names', async () => {
    // act / assert
    await expect(
      api.packages.findManyRaw('?standing=Queued&standing=Whenever'),
    ).rejects.toMatchObject({ status: 400 });
  });

  /*
   * What the row calls the case, published as three readings and an archive
   * answer. Nothing in this set uploads bytes, so nothing was read off a sheet
   * and every one of them is null — which is the promise: a row that cannot
   * name the case says nothing rather than showing a blank a reader would take
   * for a value somebody left out.
   */
  it('names the case on every row, or says null where no paper states it', async () => {
    // arrange
    const created = await submit(['erize-qeydiyyat.pdf']);
    await settled(created.id);

    // act
    const { body } = await api.packages.findMany({ search: created.id });

    // assert
    const row = body.items[0];
    expect(row?.id).toBe(created.id);
    expect(row).toHaveProperty('applicantName');
    expect(row).toHaveProperty('propertyAddress');
    expect(row).toHaveProperty('cadastralNumber');
    // Never asked, which is not the same answer as `NotFound`.
    expect(row?.archiveOutcome).toBeNull();
    expect(row?.archiveSearchApproved).toBe(false);
  });

  it('refuses a page nobody may ask for, rather than serving the whole list', async () => {
    // act / assert — the schema at the edge, before the context is called
    await expect(api.packages.findManyRaw('?limit=5000')).rejects.toMatchObject(
      { status: 400 },
    );
  });

  it('refuses a standing nobody names', async () => {
    // act / assert — an unknown filter that quietly matched everything would
    // read as an answer
    await expect(
      api.packages.findManyRaw('?standing=Whenever'),
    ).rejects.toMatchObject({ status: 400 });
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
    // The whole reason the standing exists: `Completed` says only that the run
    // reached the end, and this says what the inspector has to do about it
    // (ADR-0014).
    expect(body.standing).toBe('ShortOfDocuments');
  });
});

/*
 * The operation the report's own findings ask for: it says a document is
 * missing, and the missing document is what the inspector then has (ADR-0013).
 */
/*
 * The two figures the office states at the counter, which no paper has been
 * read for yet. They travel apart from everything the pipeline reads and are
 * never merged into it, so a reader can always tell a machine's reading from a
 * person's statement.
 */
describe('what the office declares when it takes a submission in', () => {
  it('records the ground and the year, and answers with them apart from the readings', async () => {
    // arrange / act
    const created = await submit(['erize-qeydiyyat.pdf'], {
      legalBasis: 'disposal_order',
      builtYear: 1998,
    });

    // assert
    expect(created.declared).toEqual({
      legalBasis: 'disposal_order',
      builtYear: 1998,
    });
  });

  // The submission this endpoint has always taken. Nothing about the papers
  // has changed — only what the office is now able to say alongside them.
  it('takes a submission that declares nothing', async () => {
    // arrange / act
    const created = await submit(['erize-qeydiyyat.pdf']);

    // assert
    expect(created.declared).toEqual({ legalBasis: null, builtYear: null });
  });

  it('takes either figure on its own', async () => {
    // arrange / act
    const created = await submit(['erize-qeydiyyat.pdf'], { builtYear: 1998 });

    // assert
    expect(created.declared.builtYear).toBe(1998);
    expect(created.declared.legalBasis).toBeNull();
  });

  it('shows the declaration on the package a caller opens', async () => {
    // arrange
    const created = await submit(['erize-qeydiyyat.pdf'], {
      legalBasis: 'disposal_order',
    });

    // act
    const { body } = await api.packages.findOne(created.id);

    // assert
    expect(body.declared.legalBasis).toBe('disposal_order');
  });

  /*
   * The two halves of one statement contradicting each other: a case founded on
   * a paper this policy does not register is a case this policy cannot verify.
   * Not a second-guessing of the operator's choice of profile — that choice
   * stands — and `GET /profiles/suggestion` is where they find out which
   * profile does register it.
   */
  it('refuses a ground the chosen profile does not register a right on', async () => {
    // arrange
    const files = await presigned(['erize-qeydiyyat.pdf']);

    // act, assert
    const failure = await api.packages
      .createRaw({
        profileKey: 'cadastre',
        files,
        declared: { legalBasis: 'payment_receipt' },
      })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(422);
    expect((failure as ApiError).body.code).toBe('LEGAL_BASIS_NOT_IN_PROFILE');
  });

  it('refuses a year no paper of these could be dated by, at the edge', async () => {
    // arrange
    const files = await presigned(['erize-qeydiyyat.pdf']);

    // act, assert
    await expect(
      api.packages.createRaw({
        profileKey: 'cadastre',
        files,
        declared: { builtYear: 3000 },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('files added to a package over HTTP', () => {
  it('takes the file in and answers with the package as it now stands', async () => {
    // arrange
    const created = await submit(['erize-qeydiyyat.pdf']);
    await settled(created.id);

    // act
    const { status, body } = await api.packages.addFiles(created.id, {
      files: await presigned(['sexsiyyet-vesiqe.pdf']),
    });

    // assert — 200 and the package, not 201 and a file with an address of its
    // own: the package is the only thing a caller can go and read
    expect(status).toBe(200);
    expect(body.id).toBe(created.id);
    expect(body.filesCount).toBe(2);
  });

  it('verifies the package afresh, and the detail shows both files', async () => {
    // arrange
    const created = await submit(['erize-qeydiyyat.pdf']);
    await settled(created.id);

    // act
    await api.packages.addFiles(created.id, {
      files: await presigned(['sexsiyyet-vesiqe.pdf']),
    });
    await settled(created.id);

    // assert
    const { body } = await api.packages.findOne(created.id);
    expect(body.status).toBe('Completed');
    expect(body.files).toHaveLength(2);
    expect(body.report).not.toBeNull();
  });

  it('answers 404 with PACKAGE_NOT_FOUND for a package nobody submitted', async () => {
    // act / assert
    const failure = await api.packages
      .addFiles('00000000-0000-4000-8000-000000000000', {
        files: await presigned(['erize-qeydiyyat.pdf']),
      })
      .catch((error: unknown) => error as ApiError);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(404);
    expect((failure as ApiError).body.code).toBe('PACKAGE_NOT_FOUND');
  });

  it('refuses a request that adds no file at all', async () => {
    // arrange
    const created = await submit(['erize-qeydiyyat.pdf']);
    await settled(created.id);

    // act / assert — the published schema asks for one, so the edge answers
    // before the context is troubled
    const failure = await api.packages
      .addFilesRaw(created.id, { files: [] })
      .catch((error: unknown) => error as ApiError);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(400);
  });
});

/*
 * A document sent in for one of the gaps a package publishes (COMM-80).
 *
 * What is asked of the edge here is that the route exists, that a caller is held
 * to the published schema, and that the refusal a screen will actually meet —
 * a target the package does not publish — comes back as something a client can
 * tell apart. What the package then does with the file is the context's own
 * integration set: nothing here uploads bytes, so no run reads anything.
 */
describe('a document supplied over HTTP', () => {
  it('takes the file in and answers with the package as it now stands', async () => {
    // arrange — a package short of every required paper but the application
    const created = await submit(['erize-qeydiyyat.pdf']);
    await settled(created.id);
    const [file] = await presigned(['serencam-cixaris.pdf']);

    // act
    const { status, body } = await api.packages.supplyDocument(created.id, {
      file: file!,
      expectedType: 'disposal_order',
    });

    // assert — 200 and the package, like `files` above: the document has no
    // address of its own, and it is not a document yet
    expect(status).toBe(200);
    expect(body.id).toBe(created.id);
    expect(body.filesCount).toBe(2);
  });

  // The published list and the accepted call are one list, and a screen drawing
  // its buttons off `gaps` has to be able to tell this refusal apart from a
  // malformed body.
  it('answers 409 with NO_SUCH_DOCUMENT_GAP for a paper it never offered', async () => {
    // arrange — a type this profile knows nothing about, which is therefore in
    // no gap it publishes
    const created = await submit(['erize-qeydiyyat.pdf']);
    await settled(created.id);
    const [file] = await presigned(['texniki-pasport.pdf']);

    // act / assert
    const failure = await api.packages
      .supplyDocument(created.id, {
        file: file!,
        expectedType: 'technical_passport',
      })
      .catch((error: unknown) => error as ApiError);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(409);
    expect((failure as ApiError).body.code).toBe('NO_SUCH_DOCUMENT_GAP');
  });

  it('answers 404 with PACKAGE_NOT_FOUND for a package nobody submitted', async () => {
    // arrange
    const [file] = await presigned(['serencam-cixaris.pdf']);

    // act / assert
    const failure = await api.packages
      .supplyDocument('00000000-0000-4000-8000-000000000000', {
        file: file!,
        expectedType: 'disposal_order',
      })
      .catch((error: unknown) => error as ApiError);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(404);
    expect((failure as ApiError).body.code).toBe('PACKAGE_NOT_FOUND');
  });

  it('refuses a request that names no target at all', async () => {
    // arrange
    const created = await submit(['erize-qeydiyyat.pdf']);
    await settled(created.id);
    const [file] = await presigned(['serencam-cixaris.pdf']);

    // act / assert — the published schema asks for one, so the edge answers
    // before the context is troubled
    const failure = await api.packages
      .supplyDocumentRaw(created.id, { file })
      .catch((error: unknown) => error as ApiError);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(400);
  });
});

/*
 * The one write in the whole API a person makes rather than the engine: their
 * approval of what the archive register answered about a submission (ADR-0016).
 *
 * The happy path is not here and cannot be: nothing in this set uploads bytes,
 * so no run reads an address off a sheet and no question is ever put to the
 * register. What the register does with an approval is the context's own
 * integration set; what is asked of the edge is that the route exists, that the
 * published schema is what a caller is held to, and that each of the three ways
 * a package can be in no state to be approved comes back as a refusal a client
 * can tell apart.
 */
describe('approving an archive search over HTTP', () => {
  it('refuses a package the register was never asked about', async () => {
    // arrange — the bytes were never uploaded, so no sheet states an address
    // and no check was ever put to the register
    const created = await submit(['erize-qeydiyyat.pdf']);
    await settled(created.id);

    // act
    const failure = await api.packages
      .approveArchiveSearch(created.id, { summary: 'nothing outstanding' })
      .catch((error: unknown) => error as ApiError);

    // assert — a conflict and not a bad request: the body was fine, the
    // package is in no state for it
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(409);
    expect((failure as ApiError).body.code).toBe('ARCHIVE_SEARCH_NOT_ASKED');
  });

  /*
   * The one required part of an approval, refused at the edge before the
   * context is troubled. It is required because of what this approval is not:
   * it names nobody, so one that concludes nothing would record only that a
   * button was pressed.
   */
  it('refuses an approval that concludes nothing', async () => {
    // arrange
    const created = await submit(['erize-qeydiyyat.pdf']);
    await settled(created.id);

    // act / assert
    await expect(
      api.packages.approveArchiveSearchRaw(created.id, { summary: '   ' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('answers 404 with PACKAGE_NOT_FOUND for a package nobody submitted', async () => {
    // act
    const failure = await api.packages
      .approveArchiveSearch('00000000-0000-4000-8000-000000000000', {
        summary: 'nothing outstanding',
      })
      .catch((error: unknown) => error as ApiError);

    // assert
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(404);
    expect((failure as ApiError).body.code).toBe('PACKAGE_NOT_FOUND');
  });
});

/*
 * The summary an inspector opens the office's day with, over HTTP. What each
 * number means is settled below this set; what is settled here is that the
 * route exists at all, that it is not swallowed by the one beside it, and that
 * a period the contract refuses never reaches the context.
 */
describe('the summary of a period over HTTP', () => {
  it('answers the four slices in one call', async () => {
    // arrange — so there is something to count
    const created = await submit(['erize-qeydiyyat.pdf', 'plan-sxem.pdf']);
    await settled(created.id);

    // act
    const { status, body } = await api.packages.overview();

    // assert — the schema is what checked the shape; these are the promises a
    // client renders off
    expect(status).toBe(200);
    expect(body.period).toEqual({ from: null, to: null });
    expect(body.pipeline.total).toBeGreaterThanOrEqual(1);
    expect(Object.keys(body.pipeline.byStatus).sort()).toEqual([
      'Completed',
      'Failed',
      'Pending',
      'Processing',
    ]);
    expect(body.findings.againstPackage.byKind.length).toBeGreaterThan(0);
    expect(body.archive.byOutcome.NotFound).toBeGreaterThanOrEqual(0);
  });

  /*
   * Nest matches routes in the order they are declared, so `overview` has to be
   * declared before `:id` or this path arrives as a package whose id is the
   * word "overview" and comes back a 404. Nothing in a unit test can see that.
   */
  it('is a route of its own and not a package called "overview"', async () => {
    // act
    const { status } = await api.packages.overview();

    // assert
    expect(status).toBe(200);
  });

  it('says which period the answer is about', async () => {
    // act
    const { body } = await api.packages.overview({
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-09-01T00:00:00.000Z',
    });

    // assert
    expect(body.period).toEqual({
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-09-01T00:00:00.000Z',
    });
  });

  it('refuses a bound that is not an instant', async () => {
    // act / assert
    await expect(
      api.packages.overviewRaw('?from=last%20tuesday'),
    ).rejects.toMatchObject({ status: 400 });
  });

  // Answered with zeros it would read as an office that took nothing in.
  it('refuses a period that ends before it starts', async () => {
    // act / assert
    await expect(
      api.packages.overviewRaw(
        '?from=2026-09-01T00:00:00.000Z&to=2026-08-01T00:00:00.000Z',
      ),
    ).rejects.toMatchObject({ status: 400 });
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
