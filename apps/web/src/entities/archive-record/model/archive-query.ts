/**
 * What an operator asks the archive register, and how that question reaches it.
 *
 * The register looks a property up **by address** and by nothing else: a name
 * and a parcel number are things it holds the found record *against*
 * (`AddressLookupRequest.attributes`), not things it can find one by. So the
 * three boxes on the search screen are not three search keys — the address
 * finds the record, the other two are checked against it — and this module is
 * where that asymmetry is stated once instead of being re-derived on screen.
 *
 * The question deliberately does **not** live in the address bar, unlike the
 * register's own. The lookup is a POST because the address is somebody's
 * property and "has no business in a URL, a query string or an access log"
 * (`AddressesController`); putting it in ours would put it in exactly those
 * three places the moment the page is reloaded or the link is pasted.
 */
import type { AddressLookupRequest } from '@cadastre/api-contracts/registry';

export type ArchiveQuery = {
  /** Applicant name, held against the record's `ownerName`. */
  name: string;
  /** What the register searches by. Nothing is asked without it. */
  address: string;
  /** Parcel / cadastral number, held against the record's `cadastralNumber`. */
  parcel: string;
};

export const BLANK_QUERY: ArchiveQuery = { name: '', address: '', parcel: '' };

/**
 * Whether there is anything to ask. Only the address decides: the register
 * refuses a lookup without one, and asking with a name alone would come back a
 * refusal the operator can do nothing about.
 */
export function isAskable(query: ArchiveQuery): boolean {
  return query.address.trim() !== '';
}

/**
 * The question as the register takes it.
 *
 * `documents` is left empty on purpose: the register does not volunteer a
 * holdings list, and which papers matter is a profile's rule about a submission
 * — this screen is looking a property up, not verifying one.
 */
export function toLookupRequest(query: ArchiveQuery): AddressLookupRequest {
  const attributes: AddressLookupRequest['attributes'] = [];
  const name = query.name.trim();
  const parcel = query.parcel.trim();
  if (name !== '') attributes.push({ name: 'ownerName', value: name });
  if (parcel !== '')
    attributes.push({ name: 'cadastralNumber', value: parcel });

  return { address: query.address.trim(), attributes, documents: [] };
}
