import { z } from 'zod';

import { FileInputSchema } from './create-package.dto.js';
import { PackageDtoSchema } from './package.dto.js';

/**
 * One file, sent in for one of the holes the package publishes (COMM-80).
 *
 * An operation of its own and not a target bolted onto `addFiles`, because the
 * two are different asks. `addFiles` is more of the envelope: any number of
 * files, answering nothing in particular. This is one file that answers
 * something — it names the paper it is meant to be and, where it replaces a
 * scan the run read badly, the document it stands in for. One file because a
 * target names one document; a target on a call that takes many would have to
 * mean either "each of these" or "these together", and neither is a thing an
 * operator asks for.
 *
 * The file travels the same road as every other: `documents/presign` signs the
 * URL, the browser PUTs the bytes, and this is handed the key.
 */
export const SupplyDocumentRequestSchema = z.object({
  file: FileInputSchema,
  /**
   * The profile document type this file is supposed to turn out to be, copied
   * from the `expectedType` of one of the package's published gaps.
   *
   * Checked twice, and the two checks answer different questions. Here and now:
   * that the package actually publishes a gap for it — a target that is not on
   * the list is refused with `NO_SUCH_DOCUMENT_GAP`, so a screen drawing its
   * buttons off that list can never offer an upload this would decline. Then in
   * the run, once something has read the file: if the classifier does not place
   * it under this type, the supply is refused, the gap stays open, the document
   * it was meant to replace stays in force, and the report carries a
   * `WrongDocumentSupplied` finding naming what was asked for and what arrived.
   */
  expectedType: z.string(),
  /**
   * The document this file replaces, copied from the `documentId` of an
   * `UnusableScan` gap. Omitted or null where the file answers a paper the
   * package simply did not have.
   *
   * The replaced document is not deleted. It stays in the package, marked with
   * what replaced it and when; what the report is compiled from is the document
   * in force.
   */
  replacesDocumentId: z.string().nullable().optional(),
});
export type SupplyDocumentRequest = z.infer<typeof SupplyDocumentRequestSchema>;

export const SupplyDocumentResponseSchema = PackageDtoSchema;
export type SupplyDocumentResponse = z.infer<
  typeof SupplyDocumentResponseSchema
>;
