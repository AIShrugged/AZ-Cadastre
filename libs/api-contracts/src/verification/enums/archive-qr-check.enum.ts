import { z } from 'zod';

// What came of holding one Decree 439 paper against the National Archive Fund by
// the QR reference printed on it (ADR-0028). An answer about one document, not
// about the package: the other papers are held against the archive on their own.
export const ArchiveQrCheckStatusSchema = z.enum([
  // The archive found the document, every line held against it agreed, and the
  // body that issued it was competent to issue a paper of that kind.
  'Confirmed',
  // Found, and at least one line differs from it or the issuing body was not
  // competent to issue a paper of that kind.
  'Differs',
  // The archive returned nothing under the reference. An absence of evidence,
  // told to the inspector and not held against the package.
  'NotFound',
  // No QR reference was read off the document, so there was nothing to ask.
  'NoQrCode',
]);
export type ArchiveQrCheckStatus = z.infer<typeof ArchiveQrCheckStatusSchema>;

// How one line of the paper stood against the archive's copy. `NotStated` is
// silence on either side — the paper or the archive does not give the value —
// and is never a disagreement.
export const ArchiveQrFieldVerdictSchema = z.enum([
  'Match',
  'Mismatch',
  'NotStated',
]);
export type ArchiveQrFieldVerdict = z.infer<typeof ArchiveQrFieldVerdictSchema>;

// The lines of a Decree 439 paper held against the archive, by their profile
// field keys, in the order they are published.
export const ArchiveQrFieldNameSchema = z.enum([
  'document_no',
  'issue_date',
  'issuing_authority',
  'holder_name',
  'property_address',
  'plot_area',
  'decree_item',
  'archive_reference',
]);
export type ArchiveQrFieldName = z.infer<typeof ArchiveQrFieldNameSchema>;
