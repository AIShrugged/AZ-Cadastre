import { describe, expect, it } from 'vitest';

import {
  LIST_PACKAGES_DEFAULT_LIMIT,
  PackageStandingSchema,
  ReportStatusSchema,
} from '@cadastre/api-contracts/verification';

import {
  isNarrowed,
  pageCount,
  parseRegisterQuery,
  REGISTER_PAGE_SIZE,
  registerQueryParams,
  toListRequest,
  WHOLE_REGISTER,
  type RegisterQuery,
} from './register-query';

const read = (search: string) =>
  parseRegisterQuery(new URLSearchParams(search));
const written = (query: RegisterQuery) => registerQueryParams(query).toString();

describe('the question the register puts to the server', () => {
  it('asks for the newest page of everything when nothing is narrowed', () => {
    expect(read('')).toEqual(WHOLE_REGISTER);
    expect(toListRequest(WHOLE_REGISTER)).toEqual({
      search: undefined,
      standing: undefined,
      reportStatus: undefined,
      limit: REGISTER_PAGE_SIZE,
      offset: 0,
    });
  });

  // A page is what this endpoint has instead of a whole list (ADR-0015), and
  // how big one is is the contract's answer — not a number chosen here that
  // could drift from the server's own default.
  it('takes the page size from the contract', () => {
    expect(REGISTER_PAGE_SIZE).toBe(LIST_PACKAGES_DEFAULT_LIMIT);
  });

  it('counts pages from one and rows from zero', () => {
    expect(toListRequest({ ...WHOLE_REGISTER, page: 1 }).offset).toBe(0);
    expect(toListRequest({ ...WHOLE_REGISTER, page: 3 }).offset).toBe(
      REGISTER_PAGE_SIZE * 2,
    );
  });

  // The two filters are two questions, and both travel — a request that carried
  // one of them would answer half of what was asked and look like a full answer.
  it('sends the standing and the outcome as two parameters', () => {
    const request = toListRequest({
      search: 'AZ-14',
      standing: 'Cleared',
      reportStatus: 'IssuesFound',
      page: 1,
    });

    expect(request.standing).toBe('Cleared');
    expect(request.reportStatus).toBe('IssuesFound');
    expect(request.search).toBe('AZ-14');
  });

  // A cleared search box is no term at all, which is what the endpoint's own
  // schema says an empty term means. Sending '' would ask for packages whose
  // fields contain nothing.
  it('sends no term for a cleared search box', () => {
    expect(toListRequest({ ...WHOLE_REGISTER, search: '' }).search).toBe(
      undefined,
    );
  });
});

describe('reading the question out of the address bar', () => {
  it('reads a search, both filters and a page', () => {
    expect(
      read('search=Nizami&standing=NeedsInspector&reportStatus=OK&page=4'),
    ).toEqual({
      search: 'Nizami',
      standing: 'NeedsInspector',
      reportStatus: 'OK',
      page: 4,
    });
  });

  it.each(PackageStandingSchema.options)('reads the standing %s', standing => {
    expect(read(`standing=${standing}`).standing).toBe(standing);
  });

  it.each(ReportStatusSchema.options)('reads the outcome %s', outcome => {
    expect(read(`reportStatus=${outcome}`).reportStatus).toBe(outcome);
  });

  // An address is typed by hand, pasted between people and outlives the build
  // that wrote it. A word this client has never heard of drops the filter; it
  // must never take the register down with it.
  it('drops a word it does not know rather than refusing the register', () => {
    expect(read('standing=Approved&reportStatus=Perfect')).toEqual(
      WHOLE_REGISTER,
    );
  });

  it('falls back to the first page for a page nobody could be on', () => {
    for (const page of ['0', '-3', '2.5', 'last', '']) {
      expect(read(`page=${page}`).page).toBe(1);
    }
  });

  it('treats a box holding only spaces as an empty one', () => {
    expect(read('search=%20%20').search).toBe('');
  });
});

describe('writing the question back into the address bar', () => {
  // The whole register keeps a clean address, so a link copied off an untouched
  // screen says "the register" rather than "the register as it was paged that
  // afternoon".
  it('writes nothing for the register at rest', () => {
    expect(written(WHOLE_REGISTER)).toBe('');
  });

  it('survives the round trip', () => {
    const query: RegisterQuery = {
      search: 'AZ 14/2',
      standing: 'AwaitingArchiveApproval',
      reportStatus: 'IncompletePackage',
      page: 7,
    };

    expect(read(written(query))).toEqual(query);
  });

  // The contract's own names, so the address bar, the request and the endpoint
  // spell the two questions the same way.
  it('names the parameters as the contract does', () => {
    const params = registerQueryParams({
      search: 'x',
      standing: 'Queued',
      reportStatus: 'OK',
      page: 2,
    });

    expect([...params.keys()].sort()).toEqual([
      'page',
      'reportStatus',
      'search',
      'standing',
    ]);
  });
});

describe('whether anything is holding rows back', () => {
  // What an empty answer means depends on this: nothing found under a filter is
  // a filter to clear, nothing found without one is an office that has taken
  // nothing in, and the two are not the same news.
  it('is false for the whole register, on any page of it', () => {
    expect(isNarrowed(WHOLE_REGISTER)).toBe(false);
    expect(isNarrowed({ ...WHOLE_REGISTER, page: 9 })).toBe(false);
  });

  it.each([
    { search: 'a' },
    { standing: 'Stalled' as const },
    { reportStatus: 'OK' as const },
  ])('is true once %o narrows it', narrowing => {
    expect(isNarrowed({ ...WHOLE_REGISTER, ...narrowing })).toBe(true);
  });
});

describe('how many pages the matched rows make', () => {
  it('counts a part-full last page', () => {
    expect(pageCount(41, 20)).toBe(3);
    expect(pageCount(40, 20)).toBe(2);
  });

  // A register with nothing in it is still one page: a pager reading "1 / 0"
  // says the reader is standing somewhere that does not exist.
  it('never reports fewer than one page', () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(10, 0)).toBe(1);
  });
});
