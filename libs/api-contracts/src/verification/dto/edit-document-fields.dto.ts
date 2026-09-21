import { z } from 'zod';

import { PackageDetailDtoSchema } from './package.dto.js';

/**
 * How many corrections one save may carry.
 *
 * A bound and not a ceiling anybody will meet: the largest field schema any
 * profile declares is a fraction of this, so a request over it is a client that
 * has lost its place rather than an operator with an unusually full form.
 */
export const EDIT_FIELDS_MAX_ENTRIES = 50;

// Long enough for an address on a Soviet-era allotment order and no longer. A
// field that takes a paragraph is a field somebody pastes a note into.
export const EDIT_FIELD_VALUE_MAX_LENGTH = 1000;

/**
 * What an operator corrected on one document of a package (ADR-0033).
 *
 * One call carries every correction made to one document, because that is what
 * an operator does: they fix a form and they save it. A package re-opened per
 * keystroke would run the whole pipeline five times over one edit, and four of
 * those runs would be reading a form the operator was still in the middle of.
 *
 * Every entry names a field of the document's own type in the active profile —
 * a key the schema does not declare is refused with `FIELD_NOT_IN_SCHEMA`.
 */
export const EditDocumentFieldsRequestSchema = z.object({
  fields: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        /**
         * What the paper says, as the operator reads it — or `null`, which is
         * the operator stating that the paper does **not** say it.
         *
         * A value makes the field `EnteredByOperator` whether it replaces a
         * reading or is the first value that key has ever had. A `null` drops
         * the key from the document: a later run may carry a value over from a
         * sister paper, which is correct and is the point of gathering
         * (ADR-0023).
         */
        value: z
          .string()
          .trim()
          .min(1)
          .max(EDIT_FIELD_VALUE_MAX_LENGTH)
          .nullable(),
      }),
    )
    .min(1)
    .max(EDIT_FIELDS_MAX_ENTRIES)
    // One entry per key. Two entries naming one field would be a request whose
    // meaning depends on which of them the server happened to apply last.
    .refine(
      fields => new Set(fields.map(field => field.name)).size === fields.length,
      { message: 'Each field may be corrected once per request' },
    ),
});
export type EditDocumentFieldsRequest = z.infer<
  typeof EditDocumentFieldsRequestSchema
>;

/**
 * The submission as it now stands, corrections and all — the resource the
 * correction is visible on, so a caller that has just saved one does not have
 * to ask for the package again to see what it did.
 */
export const EditDocumentFieldsResponseSchema = PackageDetailDtoSchema;
export type EditDocumentFieldsResponse = z.infer<
  typeof EditDocumentFieldsResponseSchema
>;
