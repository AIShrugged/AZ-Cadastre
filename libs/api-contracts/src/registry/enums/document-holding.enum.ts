import { z } from 'zod';

/**
 * Whether the archive holds a paper of this kind for the property.
 *
 * Three states and not a boolean, because the source data has three. The
 * archive's per-settlement presence registers write `+` against a document it
 * holds and `-` against one it does not, and the set of columns differs from
 * settlement to settlement — so a kind the register of that area never carried
 * is neither of the two. Collapsing the third into `NotHeld` would report a
 * column that was never kept as a paper that is missing.
 */
export const DocumentHoldingSchema = z.enum([
  'Held',
  'NotHeld',
  // The register of this area says nothing about this kind of paper either way.
  'Unknown',
]);
export type DocumentHolding = z.infer<typeof DocumentHoldingSchema>;
