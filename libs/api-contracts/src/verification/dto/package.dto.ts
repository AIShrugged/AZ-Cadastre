import { z } from 'zod';

import {
  ArchiveHoldingSchema,
  CrossCheckVerdictSchema,
  DocumentContentTypeSchema,
  FieldOriginSchema,
  IssueKindSchema,
  PackageStandingSchema,
  PackageStatusSchema,
  RegistryOutcomeSchema,
  ReportStatusSchema,
} from '../enums/index.js';

// Outside these a four-digit figure is not a year, which is the window the
// engine reads one in off a paper (`yearIn`). Stated here as well because the
// edge refuses a body the context would only have to refuse again.
export const DECLARED_YEAR_EARLIEST = 1800;
export const DECLARED_YEAR_LATEST = 2200;

/**
 * One value the package states about itself, as the pipeline read it off the
 * papers.
 *
 * Value and confidence and nothing else: a row names the case, it does not
 * evidence it. Which sheet the value was read off, and what the run made of it,
 * are the detail view's business — `CheckedValueDto` is where a reader goes to
 * open the page it is printed on.
 */
export const StatedValueDtoSchema = z.object({
  value: z.string(),
  // 0..1. How well the value itself was read — not how much the submission is
  // believed, which nothing here says.
  confidence: z.number(),
});
export type StatedValueDto = z.infer<typeof StatedValueDtoSchema>;

/**
 * The two figures the office declares about a submission when it takes it in.
 *
 * A source of its own, and never mixed with what the pipeline read: one is what
 * the applicant said at the counter, the other is what the papers turn out to
 * say, and telling them apart is what makes a disagreement between them
 * legible. A reading is a `StatedValueDto` and carries a confidence, because
 * something read can be read badly; a declaration carries none, because
 * somebody typed it.
 *
 * Both are optional at intake and both stay null where nothing was declared:
 * the office may take a package in knowing neither, and a placeholder here
 * would be a claim nobody made.
 */
export const DeclaredAtIntakeDtoSchema = z.object({
  // The ground the claimed right rests on, as one of the document type keys the
  // package's profile publishes as a ground — `GET /profiles` says which. Not
  // free text: a basis nothing can be matched against could suggest no profile
  // and could be held against no reading.
  legalBasis: z.string().nullable(),
  // The year the building is declared to have been built. The same window the
  // engine reads a year in, so a figure this accepts is one the branch can
  // compare against what the papers state.
  builtYear: z
    .number()
    .int()
    .min(DECLARED_YEAR_EARLIEST)
    .max(DECLARED_YEAR_LATEST)
    .nullable(),
});
export type DeclaredAtIntakeDto = z.infer<typeof DeclaredAtIntakeDtoSchema>;

export const PackageDtoSchema = z.object({
  id: z.string(),
  status: PackageStatusSchema,
  // Where the submission stands: what has to happen to it next. Worked out by
  // the context from the two states below and from what the archive register
  // was asked, and the only one of the three written for the inspector — read
  // it rather than deriving one of your own (ADR-0014).
  standing: PackageStandingSchema,
  profileKey: z.string(),
  // ─── What the office declared when it took the submission in ──────────────
  // Not a reading and never merged with one: the values below this are what the
  // papers state, and these are what somebody typed at the counter. Where both
  // exist and disagree, the report says so.
  declared: DeclaredAtIntakeDtoSchema,
  // ─── What the case is called ───────────────────────────────────────────────
  // A submission is known by the person it is for, the property it concerns and
  // the parcel that property sits on — never by its profile and its id, which
  // are the row's furniture. All three are read off the package's own documents
  // by the pipeline and stored nowhere else: which field of which document type
  // each is believed from is the Verification Profile's to say, and it names
  // several papers in the order it trusts them.
  //
  // Null means no document of this package states it yet — the run has not
  // reached the paper, or read nothing off it. Never an empty string, and never
  // a placeholder: a row that cannot name the case says so.
  applicantName: StatedValueDtoSchema.nullable(),
  propertyAddress: StatedValueDtoSchema.nullable(),
  cadastralNumber: StatedValueDtoSchema.nullable(),
  // ─── What the archive said ────────────────────────────────────────────────
  // What the archive register answered about the property (ADR-0009), as one
  // answer for the row: where the profile put more than one question to the
  // register, this is the one that decides what happens next — a contradiction
  // over a missing original over an unresolved record over no record at all,
  // and `Confirmed` only when every question was answered that way.
  //
  // Null until the register was asked, which is not the same as `NotFound`:
  // one is a question nobody put, the other is a question the archive answered
  // with silence.
  archiveOutcome: RegistryOutcomeSchema.nullable(),
  // Whether an approval of this package's archive search is in force — a
  // person's sign-off on what the register answered (ADR-0016). False both
  // where nobody has signed and where a later run has spent the signature by
  // asking the register again.
  archiveSearchApproved: z.boolean(),
  // Files the inspector uploaded. Known at submission.
  filesCount: z.number().int().nonnegative(),
  // Documents found inside those files. A file is a container, so this is 0
  // until the pipeline has read them, and may exceed filesCount.
  documentsCount: z.number().int().nonnegative(),
  classifiedCount: z.number().int().nonnegative(),
  unclassifiedCount: z.number().int().nonnegative(),
  extractedCount: z.number().int().nonnegative(),
  // Null until the run has compiled a report. A report is the last thing every
  // run produces, however much of the package it managed to read.
  reportStatus: ReportStatusSchema.nullable(),
  // Findings the report holds against the package, split in two so the row can
  // say them apart: a shortfall in the package itself, and a reading the engine
  // was unsure of. Neither counts the observations — what the run noted in
  // passing is stated for the record, never against the package, which is the
  // same rule the report's own status is decided by and the same one the detail
  // screen counts its worklist by. `issuesCount + lowConfidenceCount` is every
  // finding against the package, and that is what the card shows.
  issuesCount: z.number().int().nonnegative(),
  lowConfidenceCount: z.number().int().nonnegative(),
  // ISO-8601.
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PackageDto = z.infer<typeof PackageDtoSchema>;

export const OcrDtoSchema = z.object({
  text: z.string(),
  // 0..1.
  confidence: z.number(),
});
export type OcrDto = z.infer<typeof OcrDtoSchema>;

export const PageDtoSchema = z.object({
  pageNumber: z.number().int().positive(),
  // A short-lived link to the rendered sheet, so a finding can be checked
  // against the scan it was made from. Null when it could not be signed.
  imageUrl: z.string().nullable(),
  ocr: OcrDtoSchema.nullable(),
});
export type PageDto = z.infer<typeof PageDtoSchema>;

/**
 * The reading a carried-over value was copied from.
 *
 * Its own object and not four columns beside the field's own, because the sheet
 * in it belongs to a **different** document: a client turns `FieldDto.pageNumber`
 * into a page of the document the field hangs on, and a foreign number there
 * would open the wrong paper. Reading this one means having read `documentId`
 * first, which is the point (ADR-0023).
 */
export const FieldSourceDtoSchema = z.object({
  // The document of this package the value was read off. It is in this same
  // detail response, under one of the source files.
  documentId: z.string(),
  documentType: z.string(),
  fieldName: z.string(),
  // The sheet of THAT document's containing file, 1-based.
  pageNumber: z.number().int().positive(),
});
export type FieldSourceDto = z.infer<typeof FieldSourceDtoSchema>;

export const FieldDtoSchema = z.object({
  name: z.string(),
  value: z.string(),
  // 0..1. A value carried over from another paper is the reading it came from,
  // discounted: it can never be surer than that reading, and it is deliberately
  // a little less sure, because the package being consistent about a value is
  // not this paper stating it.
  confidence: z.number(),
  // The sheet of this document's containing file the value is printed on.
  // Null exactly when `origin` is `TakenFromAnotherDocument` — this document has
  // no sheet that states it, and `takenFrom` names the one that does.
  pageNumber: z.number().int().positive().nullable(),
  // Where the value came from. Every field published before this existed was
  // `ReadOnThisDocument`, which is what it still says.
  origin: FieldOriginSchema,
  // Set only on `TakenFromAnotherDocument`, and always set there.
  takenFrom: FieldSourceDtoSchema.nullable(),
});
export type FieldDto = z.infer<typeof FieldDtoSchema>;

export const DocumentDtoSchema = z.object({
  id: z.string(),
  // The sheets of the containing file this document occupies, 1-based and
  // inclusive.
  firstPage: z.number().int().positive(),
  lastPage: z.number().int().positive(),
  type: z.string().nullable(),
  // 0..1, null until the document is classified.
  classificationConfidence: z.number().nullable(),
  fields: z.array(FieldDtoSchema),
});
export type DocumentDto = z.infer<typeof DocumentDtoSchema>;

export const SourceFileDtoSchema = z.object({
  id: z.string(),
  originalFilename: z.string(),
  contentType: DocumentContentTypeSchema,
  pages: z.array(PageDtoSchema),
  // Empty until the pipeline has read the file into the documents it holds.
  documents: z.array(DocumentDtoSchema),
});
export type SourceFileDto = z.infer<typeof SourceFileDtoSchema>;

export const IssueDtoSchema = z.object({
  kind: IssueKindSchema,
  // The audit line, written in English when the finding was made. A reader is
  // shown the finding built from the fields below, in their own language.
  message: z.string(),
  documentId: z.string().nullable(),
  sourceFileId: z.string().nullable(),
  documentType: z.string().nullable(),
  fieldName: z.string().nullable(),
  // The profile cross-check the finding came out of. Set only for
  // FieldMismatch, where the finding is about a rule rather than one field —
  // it is what names the finding to a reader in their own language.
  checkKey: z.string().nullable(),
  pageNumber: z.number().int().positive().nullable(),
  // 0..1.
  confidence: z.number().nullable(),
});
export type IssueDto = z.infer<typeof IssueDtoSchema>;

// ─── Cross-document verification ─────────────────────────────────────────────
// What the papers of one submission were asked to agree on, and whether they
// did. Reported apart from the findings as well as through them: a check that
// agreed is evidence too, and it is what the inspector does not have to redo.

export const CheckedValueDtoSchema = z.object({
  // Null once the document it was read off is gone — the value stands, the jump
  // into the register does not.
  documentId: z.string().nullable(),
  documentType: z.string(),
  fieldName: z.string(),
  value: z.string(),
  pageNumber: z.number().int().positive(),
  // How well the value itself was read, 0..1. A check is never surer than this.
  confidence: z.number(),
});
export type CheckedValueDto = z.infer<typeof CheckedValueDtoSchema>;

export const CrossCheckDtoSchema = z.object({
  // Profile cross-check key, e.g. "applicant_identity".
  key: z.string(),
  verdict: CrossCheckVerdictSchema,
  // 0..1.
  confidence: z.number(),
  // The audit line, written in English when the check was made. A reader is
  // shown the check built from the values below.
  note: z.string(),
  // In the order the profile names them: the anchor first.
  values: z.array(CheckedValueDtoSchema),
});
export type CrossCheckDto = z.infer<typeof CrossCheckDtoSchema>;

// ─── The archive register ────────────────────────────────────────────────────
// The sixth stage, and the only one that leaves the submission: what the papers
// say about the property, held against the record of what was registered
// (ADR-0009).
//
// Published whole, agreed or not, for the same reason a cross-check is: a
// property the register confirmed is what the inspector does not have to look
// up, and a stage that reported nothing when it agreed would be a stage nobody
// could tell had run.

export const RegistryAttributeDtoSchema = z.object({
  // The name the register knows the attribute by — "ownerName",
  // "cadastralNumber", "plotArea".
  name: z.string(),
  // What the package states, and the document it was read off.
  submitted: CheckedValueDtoSchema,
  // What the record states. Null where the register is silent: a column an
  // area's register never held is silence, not a disagreement.
  recorded: z.string().nullable(),
  agrees: z.boolean(),
});
export type RegistryAttributeDto = z.infer<typeof RegistryAttributeDtoSchema>;

/**
 * One paper the package rests on, held against what the archive keeps.
 *
 * Two names, because there are two vocabularies and neither side may borrow the
 * other's: `name` is the register's own word for the kind of paper, `type` is
 * the profile's document type — which is what makes the finding land on a sheet
 * the inspector can open (ADR-0010).
 */
export const RegistryDocumentDtoSchema = z.object({
  name: z.string(),
  type: z.string(),
  // The document of this package the question was asked about, so the answer is
  // a jump into the sheet rather than a sentence about it. Null once that
  // document is gone — the answer stands, the jump does not, which is how a
  // CheckedValueDto behaves for the same reason.
  documentId: z.string().nullable(),
  pageNumber: z.number().int().positive(),
  // Held | NotHeld | Unknown. `Unknown` is the ordinary case and not a
  // shortfall: the archive's presence registers are kept per settlement and
  // their columns differ, so a kind that area never recorded is silence.
  holding: ArchiveHoldingSchema,
  // What the archive's own entry says about the paper, where it says anything.
  number: z.string().nullable(),
  issuedOn: z.string().nullable(),
  // Where that paper is, as the register stated it. Text, for the reason
  // `reference` below is.
  reference: z.string().nullable(),
});
export type RegistryDocumentDto = z.infer<typeof RegistryDocumentDtoSchema>;

export const RegistryCheckDtoSchema = z.object({
  // Profile registry-check key, e.g. "property_of_record".
  key: z.string(),
  outcome: RegistryOutcomeSchema,
  // 0..1, and never higher than the reading it was made from.
  confidence: z.number(),
  // The audit line, written in English when the register answered — including
  // which register answered. A reader is shown the check built from the fields
  // around it.
  note: z.string(),
  // The address the register was given, and where in the package it was read.
  asked: CheckedValueDtoSchema,
  // Where the paper is, as the record stated it. Null when no record was found
  // — and text, because a folder and a page range are not numbers: "06-DƏK səh.
  // 48" is a real value.
  reference: z.string().nullable(),
  // In the order the profile names them. Empty when no record was found, since
  // there was nothing to hold anything against.
  attributes: z.array(RegistryAttributeDtoSchema),
  // One line per paper the profile asked the archive about, in the order it
  // names them. Empty when no record was found, and empty on a profile that
  // asks about none.
  documents: z.array(RegistryDocumentDtoSchema),
});
export type RegistryCheckDto = z.infer<typeof RegistryCheckDtoSchema>;

// ─── The archive search, and the person who signed for it ────────────────────
// The one thing in a package a person put there rather than the engine: their
// sign-off on what the archive register answered, what they concluded from it,
// and — where they had one — a remark on signing (ADR-0016).

export const ApprovedCheckDtoSchema = z.object({
  // Profile registry-check key, e.g. "property_of_record".
  key: z.string(),
  // What the register had answered it with when the approval was given, which
  // is not necessarily what it answers now.
  outcome: RegistryOutcomeSchema,
});
export type ApprovedCheckDto = z.infer<typeof ApprovedCheckDtoSchema>;

/**
 * One approval of a submission's archive search.
 *
 * No author, and the omission is deliberate: there are no accounts in this
 * system, so a name here could only be one somebody typed — the appearance of
 * accountability rather than the thing (ADR-0016).
 *
 * `supersededAt` is what makes a spent approval legible instead of silent. An
 * approval covers the state of the archive search it was given, so a run that
 * asks the register again ends it: the row stays, saying what was signed for
 * and when it stopped counting. Only an approval with `supersededAt` null is in
 * force, and a package has at most one.
 */
export const ArchiveSearchApprovalDtoSchema = z.object({
  // ISO-8601.
  approvedAt: z.string(),
  // ISO-8601, and null while the approval stands.
  supersededAt: z.string().nullable(),
  // What the search means for this submission as a whole. Always stated.
  summary: z.string(),
  // A remark on the act of approving. Null where the person had none.
  comment: z.string().nullable(),
  // What the register had answered at the moment it was signed for, in the
  // order the package held them.
  checks: z.array(ApprovedCheckDtoSchema),
});
export type ArchiveSearchApprovalDto = z.infer<
  typeof ArchiveSearchApprovalDtoSchema
>;

export const ReportDtoSchema = z.object({
  status: ReportStatusSchema,
  // ISO-8601.
  generatedAt: z.string(),
  issues: z.array(IssueDtoSchema),
});
export type ReportDto = z.infer<typeof ReportDtoSchema>;

export const PackageDetailDtoSchema = PackageDtoSchema.extend({
  files: z.array(SourceFileDtoSchema),
  // Empty until the cross-document stage has run, and short of the profile's
  // full list where a check had only one document to read.
  crossChecks: z.array(CrossCheckDtoSchema),
  // Empty until the register stage has run — and where the value a check asks
  // about could not be read, it stays empty: a question nobody could put is
  // already in the report as the reading that failed.
  registryChecks: z.array(RegistryCheckDtoSchema),
  // Every approval the archive search has had, newest first — the spent ones
  // too, because a signature over answers the package has since replaced is
  // exactly what a reader has to be able to see. At most one has no
  // `supersededAt`; that is the one in force, and `standing` is worked out from
  // it. Empty until somebody signs.
  archiveSearchApprovals: z.array(ArchiveSearchApprovalDtoSchema),
  report: ReportDtoSchema.nullable(),
});
export type PackageDetailDto = z.infer<typeof PackageDetailDtoSchema>;
