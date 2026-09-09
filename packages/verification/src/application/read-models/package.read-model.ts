/**
 * One value the package states about itself, as the pipeline read it: the value
 * and how well it was read, and nothing about where it came from. A row names
 * the case; the detail view is what evidences it.
 */
export type StatedValueView = {
  value: string;
  // 0..1.
  confidence: number;
};

export type PackageSummaryView = {
  id: string;
  status: string;
  // Where the submission stands: what has to happen to it next. Worked out from
  // the status, the report and what the register was asked; never stored, so
  // there is no row that can fall out of step with it (ADR-0014).
  standing: string;
  profileKey: string;
  // What the case is called: the person it is for, the property it concerns and
  // the parcel that property sits on. Read off the package's own extracted
  // fields, off whichever paper the package's Verification Profile believes
  // each of them from; null where no document of it states one yet.
  applicantName: StatedValueView | null;
  propertyAddress: StatedValueView | null;
  cadastralNumber: StatedValueView | null;
  // What the archive register answered, as one answer for the row: where more
  // than one question was put, the one that decides what happens next. Null
  // until the register was asked at all, which is not `NotFound`.
  archiveOutcome: string | null;
  // Whether an approval of the archive search is in force. False where nobody
  // has signed and where a later run has spent the signature (ADR-0016).
  archiveSearchApproved: boolean;
  filesCount: number;
  documentsCount: number;
  classifiedCount: number;
  unclassifiedCount: number;
  extractedCount: number;
  // Null until the run has compiled a report.
  reportStatus: string | null;
  // Findings held against the package, said apart: a shortfall in the package,
  // and a reading the engine was unsure of. Observations are in neither.
  issuesCount: number;
  lowConfidenceCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type IssueView = {
  kind: string;
  message: string;
  documentId: string | null;
  sourceFileId: string | null;
  documentType: string | null;
  fieldName: string | null;
  // Set only for a cross-document finding: the profile rule it came out of.
  checkKey: string | null;
  pageNumber: number | null;
  confidence: number | null;
};

export type CheckedValueView = {
  documentId: string | null;
  documentType: string;
  fieldName: string;
  value: string;
  pageNumber: number;
  confidence: number;
};

export type CrossCheckView = {
  key: string;
  verdict: string;
  confidence: number;
  note: string;
  values: readonly CheckedValueView[];
};

export type RegistryAttributeView = {
  name: string;
  submitted: CheckedValueView;
  // Null where the register is silent about the attribute.
  recorded: string | null;
  agrees: boolean;
};

export type RegistryDocumentView = {
  name: string;
  // Held | NotHeld | Unknown.
  holding: string;
  number: string | null;
  issuedOn: string | null;
  reference: string | null;
  // Null once the document it was asked about is gone.
  documentId: string | null;
  documentType: string;
  pageNumber: number;
};

export type RegistryCheckView = {
  key: string;
  outcome: string;
  confidence: number;
  note: string;
  asked: CheckedValueView;
  // Where the paper is, as the record stated it; null when none was found.
  reference: string | null;
  attributes: readonly RegistryAttributeView[];
  // One line per paper the profile asked the archive about, in the order it
  // names them.
  documents: readonly RegistryDocumentView[];
};

/**
 * One approval of an archive search, as the register holds it: what a person
 * concluded, any remark they made on signing, when they signed, and — when a
 * later run has since asked the register again — when it stopped being in
 * force.
 *
 * No author, because there is none to record (ADR-0016).
 */
export type ArchiveSearchApprovalView = {
  approvedAt: Date;
  // Null while the approval stands. Set once the archive search it covered was
  // made again, which is what ends it.
  supersededAt: Date | null;
  summary: string;
  comment: string | null;
  // What the register had answered at the moment it was signed for.
  checks: readonly ApprovedCheckView[];
};

export type ApprovedCheckView = {
  key: string;
  outcome: string;
};

export type ReportView = {
  status: string;
  generatedAt: Date;
  issues: readonly IssueView[];
};

export type OcrView = {
  text: string;
  // 0..1.
  confidence: number;
};

export type PageView = {
  pageNumber: number;
  ocr: OcrView | null;
  // Where the rendered sheet lives, and — once the query has signed for it — a
  // URL the inspector's browser can open it at. The register keeps the key; the
  // link is minted per request and expires, so it is never stored anywhere.
  imageStorageKey: string;
  imageUrl: string | null;
};

export type FieldView = {
  name: string;
  value: string;
  confidence: number;
  pageNumber: number;
};

export type DocumentView = {
  id: string;
  firstPage: number;
  lastPage: number;
  type: string | null;
  classificationConfidence: number | null;
  fields: readonly FieldView[];
};

export type SourceFileView = {
  id: string;
  originalFilename: string;
  contentType: string;
  pages: readonly PageView[];
  documents: readonly DocumentView[];
};

export type PackageDetailView = PackageSummaryView & {
  files: readonly SourceFileView[];
  // Every check the run was able to make, agreed or not: one that agreed is
  // work the inspector does not have to redo.
  crossChecks: readonly CrossCheckView[];
  // What the archive register said about the property, agreed or not — for the
  // same reason: a record that confirmed it is a lookup the inspector does not
  // have to make.
  registryChecks: readonly RegistryCheckView[];
  /*
   * Every approval this submission's archive search has had, newest first, and
   * not only the one in force. A spent one is what says a person signed for
   * answers the package has since replaced — hiding it would be the silence
   * ADR-0016 exists to prevent. At most one of them has no `supersededAt`, and
   * that one is what the standing is worked out from.
   */
  archiveSearchApprovals: readonly ArchiveSearchApprovalView[];
  report: ReportView | null;
};
