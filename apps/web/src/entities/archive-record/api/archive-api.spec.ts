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
