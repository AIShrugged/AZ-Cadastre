import { z } from 'zod';

/**
 * What the archive can be searched *by* — as opposed to what a found record can
 * be held *against*.
 *
 * The distinction is the whole of the difference between this and the lookup.
 * `AddressesApi` finds by address and by nothing else, and the owner's name and
 * the cadastral number are `attributes` it checks the one record it resolved to
 * against. An operator at the archive counter has the other two as often as
 * they have the address — a name on a paper, a parcel number on a plan — and
 * for them each of the three is a way in.
 *
 * The three are spelled as the register's own field names, so a criterion and
 * the field of `ArchiveRecordDto` it was compared with are one word.
 */
export const SearchCriterionSchema = z.enum([
  'address',
  'ownerName',
  'cadastralNumber',
]);
export type SearchCriterion = z.infer<typeof SearchCriterionSchema>;
