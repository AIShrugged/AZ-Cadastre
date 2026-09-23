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
  // A code was decoded, its issuer was asked, and the asking failed — the
  // service could not be reached or would not answer. The paper is unchecked,
  // and this says so rather than leaving the check off the page (ADR-0037).
  'IssuerUnreachable',
]);
export type ArchiveQrCheckStatus = z.infer<typeof ArchiveQrCheckStatusSchema>;

// How one line of the paper stood against the archive's copy. Three of the five
// are ways of not having stood at all, and they are different facts (ADR-0040,
// ADR-0041).
export const ArchiveQrFieldVerdictSchema = z.enum([
  'Match',
  'Mismatch',
  // Silence on either side — the paper or the archive does not give the value.
  // The line was compared and one side had nothing to compare with. Never a
  // disagreement.
  'NotStated',
  // The line was never put to the archive: the service asked does not supply it
  // at all, so there was no archive value to be silent with. Today this is
  // `issuing_authority` and only it — the archive's service states no issuing
  // body, and this system declines to read one off a scan (ADR-0034, ADR-0040).
  // `documentValue` is still what the paper says; `archiveValue` is always null.
  'NotCompared',
  // The archive answered and served its own copy of the paper, and this system
  // could not read it: the link would not open, the file was not a PDF, or the
  // reader refused (ADR-0041). Not the archive's silence but our failure, and
  // the only one of the three the report should put on our side of the page.
  // `documentValue` is still what the paper says; `archiveValue` is always
  // null, and a later run of the package asks the archive again.
  'NotRead',
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
