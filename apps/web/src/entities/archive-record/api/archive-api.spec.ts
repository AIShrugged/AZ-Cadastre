/**
 * The cache side of the summary: what makes the band re-ask, and what does not.
 *
 * Worth a store and a fetch rather than an assertion on the endpoint object,
 * because the thing that breaks here is a pairing, not a value — a tag declared
 * on one side and spelled differently on the other reads perfectly in both
 * files and never refetches anything.
 */
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/shared/api';

import { archiveApi, archiveHoldingsChanged } from './archive-api';

/** One line per source, and the totals the register derives from them. */
const summary = (records: number) => ({
  sources: records > 0 ? 1 : 0,
  records,
  loadedAt: records > 0 ? '2026-09-09T10:00:00.000Z' : null,
  bySource: [
    {
      id: 'EMDK',
      records,
      loadedAt: records > 0 ? '2026-09-09T10:00:00.000Z' : null,
    },
  ],
});

const answers = vi.fn();

/**
 * A base query built for a browser, run in one that is not there.
 *
 * `fetchBaseQuery` is pointed at `/api` — a path, because the client is served
 * from the same origin as the gateway — and a relative URL is only a URL where
 * there is a document to resolve it against. This is that document's origin,
 * and nothing more: the request the register would receive is unchanged.
 */
class OriginBoundRequest extends Request {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(
      typeof input === 'string' ? new URL(input, 'http://web.test') : input,
      init,
    );
  }
}

const storeWithApi = () =>
  configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware().concat(api.middleware),
  });

beforeEach(() => {
  vi.stubGlobal('Request', OriginBoundRequest);
  answers.mockReset();
  answers.mockImplementation(
    async () =>
      new Response(JSON.stringify(summary(1200)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', answers);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('archiveSummary', () => {
  it('asks the gateway’s route and not the register directly', async () => {
    const store = storeWithApi();

    await store.dispatch(archiveApi.endpoints.archiveSummary.initiate());

    expect(answers).toHaveBeenCalledTimes(1);
    expect((answers.mock.calls[0][0] as Request).url).toBe(
      'http://web.test/api/registry/summary',
    );
  });

  it('re-asks the register once the archive is said to have changed', async () => {
    const store = storeWithApi();
    // A subscription and not a one-off read: the band is on screen, which is
    // the case the invalidation exists for.
    store.dispatch(archiveApi.endpoints.archiveSummary.initiate());
    await vi.waitFor(() => expect(answers).toHaveBeenCalledTimes(1));

    store.dispatch(archiveHoldingsChanged());

    await vi.waitFor(() => expect(answers).toHaveBeenCalledTimes(2));
  });

  it('holds its answer while nothing says the archive moved', async () => {
    const store = storeWithApi();
    store.dispatch(archiveApi.endpoints.archiveSummary.initiate());
    await vi.waitFor(() => expect(answers).toHaveBeenCalledTimes(1));

    // Something else in the store going stale is not the archive going stale:
    // a tag that swept the summary along with it would put the register back on
    // a poll nobody asked for.
    store.dispatch(api.util.invalidateTags(['Package']));
    // Same argument, so the cached answer stands.
    await store.dispatch(archiveApi.endpoints.archiveSummary.initiate());

    expect(answers).toHaveBeenCalledTimes(1);
  });
});

/**
 * The archive search: the door it knocks on, and what it does with an answer it
 * does not recognise.
 *
 * The parse is the part worth a store and a fetch. `transformResponse` is the
 * one place the register and this client can drift apart without either side
 * type-checking the other, and a schema that stopped being applied would render
 * as `undefined` in a row rather than fail.
 */
const searchAnswer = (confidence: number) => ({
  threshold: 0.5,
  matches: [
    {
      record: {
        registerNo: '308011000692',
        inventoryNo: null,
        address: 'Hövsan qəs., Zərifə Əliyeva küç. 14',
        ownerName: 'Məmmədov Elçin Vaqif oğlu',
        cadastralNumber: null,
        plotArea: '600 m²',
        location: null,
        documents: [],
      },
      source: { name: 'Hövsan:qəbul edilən', register: 'Hovsan' },
      confidence,
      criteria: [
        {
          criterion: 'ownerName',
          submitted: 'Məmmədov Elçin',
          recorded: 'Məmmədov Elçin Vaqif oğlu',
          confidence,
        },
      ],
      disputed: false,
    },
  ],
  matched: 1,
  considered: 12,
  sources: ['Hövsan:qəbul edilən'],
  disagreements: [],
  note: '1 of 12 records compared reach a confidence of 0.50, searching by ownerName.',
});

describe('searchArchive', () => {
  it('asks the gateway’s search route with the question in the body', async () => {
    answers.mockImplementation(
      async () =>
        new Response(JSON.stringify(searchAnswer(0.86)), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const store = storeWithApi();

    await store.dispatch(
      archiveApi.endpoints.searchArchive.initiate({
        ownerName: 'Məmmədov Elçin',
        threshold: 0.5,
        limit: 20,
      }),
    );

    const request = answers.mock.calls[0][0] as Request;
    expect(request.url).toBe('http://web.test/api/registry/search');
    // A POST, because a name is somebody's property and has no business in a
    // URL, a query string or an access log.
    expect(request.method).toBe('POST');
    expect(await request.json()).toEqual({
      ownerName: 'Məmmədov Elçin',
      threshold: 0.5,
      limit: 20,
    });
  });

  it('hands the answer on as the contract’s own shape', async () => {
    answers.mockImplementation(
      async () =>
        new Response(JSON.stringify(searchAnswer(0.86)), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const store = storeWithApi();

    const result = await store.dispatch(
      archiveApi.endpoints.searchArchive.initiate({
        ownerName: 'Məmmədov Elçin',
        threshold: 0.5,
        limit: 20,
      }),
    );

    expect(result.data?.matches[0]?.confidence).toBe(0.86);
    expect(result.data?.matches[0]?.criteria[0]?.criterion).toBe('ownerName');
    expect(result.data?.considered).toBe(12);
  });

  it('fails on a register that has drifted from the contract', async () => {
    // A confidence outside 0…1 is the register saying something this client
    // cannot band. Better a failed query than a row drawn from a number no
    // scale covers.
    answers.mockImplementation(
      async () =>
        new Response(JSON.stringify(searchAnswer(1.4)), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const store = storeWithApi();

    const result = await store.dispatch(
      archiveApi.endpoints.searchArchive.initiate({
        ownerName: 'Məmmədov Elçin',
        threshold: 0.5,
        limit: 20,
      }),
    );

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
  });
});
