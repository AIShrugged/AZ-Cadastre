import { z } from 'zod';

// What came of resolving the QR code decoded off one paper (ADR-0028,
// ADR-0034). An answer about one document, not about the package: every paper
// that prints a code is resolved on its own.
export const ArchiveQrCheckStatusSchema = z.enum([
  // The issuer answered, nothing it stated disagrees with the paper, any
  // signature it reported verified, and the body that issued the paper was
  // competent to issue a paper of that kind where that is a question the Decree
  // answers.
  'Confirmed',
  // Answered, and at least one line differs, the signature on the sheet did not
  // verify, or the issuing body was not competent to issue a paper of that kind.
  'Differs',
  // The issuer was asked and returned nothing under the reference — or returned
  // a record stating nothing the paper could be held to. An absence of evidence,
  // told to the inspector and not held against the package.
  'NotFound',
  // No QR code was decoded off the document, so there was nothing to ask.
  'NoQrCode',
  // A code was decoded and whoever issued it is not connected to this system, so
  // it was never asked. The absence `IntegrationNotConnected` states for a whole
  // type, narrowed to one sheet and naming the service that would settle it.
  'IssuerNotConnected',
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
