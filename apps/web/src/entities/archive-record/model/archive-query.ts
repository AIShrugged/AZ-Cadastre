/**
 * What an operator asks the archive register, and how that question reaches it.
 *
 * **Three keys, and any one of them is enough.** Until COMM-56 the register
 * could only find a property by address, and a name or a parcel number were
 * things it held the found record *against* — so the three boxes on the search
 * screen were one search key and two checks. The archive search (`ArchiveSearchApi`)
 * ended that: each of the three is a way in, several together narrow rather
 * than widen, and the only question the register refuses is one that names none
 * of them. That is what `isAskable` now says, and it is the whole reason this
 * module was rewritten rather than extended.
 *
 * The threshold travels with the question because it *is* part of the question:
 * how much doubt is worth reading through depends on why somebody is searching,
 * and the register does not know why (ADR-0009). It is carried as the number
 * the contract takes; which words that number is offered in is the screen's
 * business (`model/match.ts`).
 *
 * The question deliberately does **not** live in the address bar, unlike the
 * register's own. The search is a POST because a name and an address are
 * somebody's property and have "no business in a URL, a query string or an
 * access log" (`ArchiveSearchController`); putting it in ours would put it in
 * exactly those three places the moment the page is reloaded or the link is
 * pasted.
 */
import {
  DEFAULT_SEARCH_THRESHOLD,
  SEARCH_DEFAULT_LIMIT,
  type ArchiveSearchRequest,
} from '@cadastre/api-contracts/registry';

export type ArchiveQuery = {
  /** Applicant or owner name, searched by and graded against `ownerName`. */
  name: string;
  /** The address as the operator has it, in whatever spelling. */
  address: string;
  /** Parcel / cadastral number, as far as it is known — half of one finds a
   *  record too, which is the point of grading rather than matching. */
  parcel: string;
  /** How sure the register must be before it offers a record at all, 0…1. */
  threshold: number;
};

export const BLANK_QUERY: ArchiveQuery = {
  name: '',
  address: '',
  parcel: '',
  // The contract's own default and not a number chosen here: a screen with its
  // own idea of "sure enough" would answer a different question than the one
  // the register documents (`DEFAULT_SEARCH_THRESHOLD`).
  threshold: DEFAULT_SEARCH_THRESHOLD,
};

/**
 * Whether there is anything to ask.
 *
 * One non-empty criterion, any of the three. A search naming none of them is a
 * request for the whole archive, and the archive is not a list — the register
 * refuses it, so the form does not send it.
 */
export function isAskable(query: ArchiveQuery): boolean {
  return (
    query.address.trim() !== '' ||
    query.name.trim() !== '' ||
    query.parcel.trim() !== ''
  );
}

/**
 * The question as the register takes it.
 *
 * A box left blank is left **out** of the request rather than sent as an empty
 * string: an empty criterion the register accepted would be a criterion every
 * record fails, and the contract refuses one anyway. The request is also the
 * cache key, so two searches that differ only in whitespace are one call.
 */
export function toSearchRequest(query: ArchiveQuery): ArchiveSearchRequest {
  const address = query.address.trim();
  const ownerName = query.name.trim();
  const cadastralNumber = query.parcel.trim();

  const request: ArchiveSearchRequest = {
    threshold: query.threshold,
    // Stated rather than left to the default, so the answer can be read
    // against what was asked for without knowing the register's own number.
    limit: SEARCH_DEFAULT_LIMIT,
  };

  if (address !== '') request.address = address;
  if (ownerName !== '') request.ownerName = ownerName;
  if (cadastralNumber !== '') request.cadastralNumber = cadastralNumber;

  return request;
}
