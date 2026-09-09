import type {
  ArchiveSearchRequest,
  ArchiveSearchResponse,
} from '../dto/index.js';

/**
 * The archive searched, as opposed to a property looked up.
 *
 * An area of its own and not a widening of `AddressesApi`, because the two
 * answer different questions for different callers. A lookup is asked on a
 * submission's behalf: it has an address, it resolves to one record or refuses
 * to choose, and a verification stage acts on what comes back. A search is
 * asked by a person standing at the archive with a name, or half a parcel
 * number, or an address written the way the applicant wrote it — it offers
 * every record that might be the one, says how sure it is of each, and acts on
 * nothing.
 *
 * Keeping them apart is what lets the lookup stay unforgiving. A stage that
 * acted on a 0.6 match would be guessing on somebody's behalf; an operator
 * reading a 0.6 match is doing their job.
 */
export interface ArchiveSearchApi {
  search(request: ArchiveSearchRequest): Promise<ArchiveSearchResponse>;
}
