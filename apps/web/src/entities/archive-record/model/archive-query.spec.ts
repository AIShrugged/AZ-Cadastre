/**
 * The question the search screen puts to the register.
 *
 * Tested in the model and not through the form: components are not rendered in
 * this set (TECH_DEBT §3), and everything worth guarding here is a rule about
 * what reaches the wire — which box is optional, what an empty box becomes, and
 * whether the register would take the result at all.
 *
 * The last of those is checked against the contract's own schema rather than by
 * hand. A request this module builds and the register refuses is the one
 * failure a shape assertion here would miss.
 */
import { describe, expect, it } from 'vitest';

import {
  ArchiveSearchRequestSchema,
  DEFAULT_SEARCH_THRESHOLD,
  MATCH_BAND_FLOOR,
  SEARCH_DEFAULT_LIMIT,
} from '@cadastre/api-contracts/registry';

import {
  BLANK_QUERY,
  isAskable,
  toSearchRequest,
  type ArchiveQuery,
} from './archive-query';

const query = (filled: Partial<ArchiveQuery>): ArchiveQuery => ({
  ...BLANK_QUERY,
  ...filled,
});

describe('isAskable', () => {
  it('has nothing to ask on an empty form', () => {
    expect(isAskable(BLANK_QUERY)).toBe(false);
  });

  it.each([
    ['an address alone', { address: 'Hövsan qəs., Zərifə Əliyeva 14' }],
    ['a name alone', { name: 'Məmmədov Elçin Vaqif oğlu' }],
    ['half a cadastral number', { parcel: '3080110' }],
  ])('asks on %s', (_case, filled) => {
    // The whole of COMM-56 on this screen: each of the three is a way in, and
    // the form no longer refuses two of them.
    expect(isAskable(query(filled))).toBe(true);
  });

  it('does not mistake whitespace for a criterion', () => {
    expect(isAskable(query({ address: '   ', name: '\t', parcel: ' ' }))).toBe(
      false,
    );
  });

  it('stays askable when the bar is moved on a filled form', () => {
    expect(
      isAskable(query({ name: 'Məmmədov', threshold: MATCH_BAND_FLOOR.High })),
    ).toBe(true);
  });
});

describe('toSearchRequest', () => {
  it('sends the three criteria the operator filled in', () => {
    const request = toSearchRequest(
      query({
        address: 'Hövsan qəs., Zərifə Əliyeva 14',
        name: 'Məmmədov Elçin',
        parcel: '308011000692',
      }),
    );

    expect(request).toEqual({
      address: 'Hövsan qəs., Zərifə Əliyeva 14',
      ownerName: 'Məmmədov Elçin',
      cadastralNumber: '308011000692',
      threshold: DEFAULT_SEARCH_THRESHOLD,
      limit: SEARCH_DEFAULT_LIMIT,
    });
    expect(ArchiveSearchRequestSchema.parse(request)).toBeTruthy();
  });

  it('leaves an unfilled box out rather than sending it empty', () => {
    const request = toSearchRequest(query({ name: 'Məmmədov Elçin' }));

    // Not `address: ''`. An empty criterion is one every record fails, and the
    // contract refuses one outright.
    expect(request).toEqual({
      ownerName: 'Məmmədov Elçin',
      threshold: DEFAULT_SEARCH_THRESHOLD,
      limit: SEARCH_DEFAULT_LIMIT,
    });
    expect('address' in request).toBe(false);
    expect('cadastralNumber' in request).toBe(false);
    expect(ArchiveSearchRequestSchema.parse(request)).toBeTruthy();
  });

  it('trims what was typed, so one question is one call', () => {
    // The request doubles as the cache key: a trailing space is not a second
    // search.
    expect(toSearchRequest(query({ parcel: '  308011000692  ' }))).toEqual(
      toSearchRequest(query({ parcel: '308011000692' })),
    );
  });

  it('carries the bar the operator set', () => {
    const request = toSearchRequest(
      query({ address: 'Hövsan qəs.', threshold: MATCH_BAND_FLOOR.High }),
    );

    expect(request.threshold).toBe(MATCH_BAND_FLOOR.High);
  });

  it('starts at the threshold the contract publishes', () => {
    // A screen with its own idea of "sure enough" would answer a different
    // question than the register documents.
    expect(BLANK_QUERY.threshold).toBe(DEFAULT_SEARCH_THRESHOLD);
  });

  it('builds a request the register refuses when nothing was filled in', () => {
    // `isAskable` is what stops this being sent; that the contract would also
    // refuse it is what makes the guard checkable rather than a convention.
    expect(() =>
      ArchiveSearchRequestSchema.parse(toSearchRequest(BLANK_QUERY)),
    ).toThrow();
  });
});
