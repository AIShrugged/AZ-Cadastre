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

/**
 * What the office declared about a submission when it took it in, as the
 * register holds it: a source of its own, never merged with what was read.
 *
 * No confidence on either, and that is the point of the type: a reading can be
 * a bad reading and says how sure it is, a declaration was typed by a person
 * and is only ever what they said.
 */
export type DeclaredAtIntakeView = {
  // A document type key of the package's profile, or null where none was
  // declared.
  legalBasis: string | null;
  builtYear: number | null;
};

export type PackageSummaryView = {
  id: string;
  status: string;
  // Where the submission stands: what has to happen to it next. Worked out from
  // the status, the report and what the register was asked; never stored, so
  // there is no row that can fall out of step with it (ADR-0014).
  standing: string;
  profileKey: string;
  // What the office declared at the counter, kept apart from what the pipeline
  // read off the papers below.
  declared: DeclaredAtIntakeView;
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
  // The sheet of THIS document the value is printed on. Null exactly when the
  // value was not read off this document — see `origin` (ADR-0023).
  pageNumber: number | null;
  // One of the domain's `FieldOrigin` members.
  origin: string;
  // Where a carried-over value was read: the document of this package, its
  // type, its field and the sheet of THAT document. Null on a value read here.
  takenFrom: {
    documentId: string;
    documentType: string;
    fieldName: string;
    pageNumber: number;
  } | null;
  // Who last corrected this value by hand, and when. Both null on every field
  // nobody has touched, and both set on exactly the `EnteredByOperator` ones
  // (ADR-0033).
  editedByAccountId: string | null;
  editedAt: Date | null;
};

/**
 * One of the two marks an office attests a paper with, as the run saw it: what
 * the profile expects of a paper of this type, and what the sheets actually
 * say. The two are stated apart because they are independent — a seal on a
 * paper nobody asked to be sealed is still a seal.
 */
export type DocumentMarkView = {
  expected: boolean;
  // One of the domain's `MarkState` members: Present | Illegible | Absent |
  // Unread. `Unread` is the answer on a document no sheet of which was read,
  // and it is not `Absent`: nothing was looked at.
  state: string;
  // The legends read off the seals, in reading order. Empty for a signature and
  // on any state but `Present`.
  legends: readonly string[];
  // 0..1, never above the least confident sheet of the document. Null on
  // `Unread`.
  confidence: number | null;
};

export type DocumentAttestationView = {
  stamp: DocumentMarkView;
  signature: DocumentMarkView;
};

/**
 * One thing the package will take a document for, and why — the engine's own
 * answer, carried across as it was worked out (COMM-80).
 *
 * The reason is one of the domain service's `GapReason` members; `documentId`
 * and `sourceFileId` are set only on `UnusableScan`, where filling the gap
 * replaces a document that is already here.
 */
export type DocumentGapView = {
  reason: string;
  expectedType: string;
  documentId: string | null;
  sourceFileId: string | null;
};

// What a file sent in after the submission was answering. Null on every file
// the package was created with.
export type SuppliedForView = {
  expectedType: string;
  replacesDocumentId: string | null;
};

/**
 * What the National Archive Fund said about one Decree 439 paper, asked by the
 * QR reference printed on it (ADR-0028). Statuses and verdicts are the domain's
 * `ArchiveQrStatus` and `ArchiveQrVerdict`, in strings.
 */
export type ArchiveQrCheckView = {
  status: string;
  qrReference: string | null;
  checkedAt: Date;
  issuingAuthorityCompetent: boolean | null;
  issuer: string | null;
  signatureSignedBy: string | null;
  signatureOrganisation: string | null;
  signatureUnit: string | null;
  signatureSignedOn: string | null;
  // How long the signing certificate is good for, in the words the panel or the
  // service states it in. Null on every check stored before the signed PDF was
  // digitised (ADR-0035).
  signatureCertificateValidity: string | null;
  signatureValid: boolean | null;
  fields: readonly {
    name: string;
    documentValue: string | null;
    archiveValue: string | null;
    verdict: string;
  }[];
};

/**
 * One sheet of a design set with the span working drawn onto it (COMM-165).
 *
 * The register keeps the key; the link is minted per request and expires, for
 * the reason a page's is — a URL that opens somebody's drawing has no business
 * outliving the screen that showed it.
 */
export type SpanMarkupSheetView = {
  pageNumber: number;
  imageStorageKey: string;
  imageUrl: string | null;
  rooms: number;
  axes: number;
};

export type SpanMarkupView = {
  // Never empty: a document nothing could be drawn for carries no markup.
  sheets: readonly SpanMarkupSheetView[];
  // One of the domain's `SPAN_UNITS` and `SPAN_UNIT_BASES`, or null in both
  // where nothing decided the unit — and then the lengths on the pictures are
  // labelled «ед.».
  unit: string | null;
  unitBasis: string | null;
  // Why the markup is incomplete or empty, in the words of an audit.
  note: string | null;
};

export type DocumentView = {
  id: string;
  firstPage: number;
  lastPage: number;
  type: string | null;
  classificationConfidence: number | null;
  // What the sheets say about the seal and the signature. Null until the
  // document is placed under a type of the profile: without a type there is no
  // specification, and so no answer about what was expected of the paper.
  attestation: DocumentAttestationView | null;
  fields: readonly FieldView[];
  // Null on a paper that is not a Decree 439 title, and on one the archive has
  // not been asked about yet.
  archiveQrCheck: ArchiveQrCheckView | null;
  // The span working drawn onto this paper's sheets. Non-empty only on the
  // types of design documentation a span is read off, and null on a design set
  // no run has marked up yet (COMM-165).
  spanMarkup: SpanMarkupView | null;
  // What replaced this document and when, or null while it is in force. A
  // replaced document stays in the package and stays readable; nothing the
  // package states is worked out from it (COMM-80).
  supersededById: string | null;
  supersededAt: Date | null;
};

export type SourceFileView = {
  id: string;
  originalFilename: string;
  contentType: string;
  suppliedFor: SuppliedForView | null;
  pages: readonly PageView[];
  documents: readonly DocumentView[];
};

/*
 * Which provision of Article 8 a package's case falls under, and how the
 * package answers it — the domain's `CaseProvision`, in strings (ADR-0025).
 */
export type ProvisionView = {
  key: string;
  // Determined | Ambiguous | Undetermined.
  outcome: string;
  // The provision applied, set exactly on `Determined`.
  provision: string | null;
  // The provisions still open, set exactly on `Ambiguous`.
  candidates: readonly string[];
  // The figures whose reading would settle an ambiguous case.
  undecidedOn: readonly string[];
  parameters: readonly ParameterView[];
  // Every row of the table and how the case stood against each of its
  // conditions, in the table's order: what a reader holds the decision to.
  rules: readonly RuleEvaluationView[];
  // The determined provision, or every candidate. Empty where none applies.
  provisions: readonly ProvisionStandingView[];
  titleDocuments: readonly TitleDocumentStandingView[];
};

export type ParameterView = {
  // One of the domain's `CASE_PARAMETERS`.
  parameter: string;
  // What the table was decided on: a number for the four measures, a word for
  // the right and the purpose, null where the figure could not be established.
  value: number | string | null;
  // One of the domain's `PARAMETER_SOURCES`, or null where nothing stated it.
  source: string | null;
  // The words the figure was read out of, or the declared year.
  stated: string | null;
  from: {
    documentId: string;
    documentType: string;
    fieldName: string | null;
    pageNumber: number | null;
    confidence: number | null;
  } | null;
  // How the span was worked out of the axis chains (ADR-0043); null for every
  // other figure, and for a span nothing stated.
  calculation: SpanCalculationView | null;
};

export type SpanCalculationView = {
  // Metres; null where a check refused the reading.
  longest: number | null;
  chains: readonly {
    // One of the domain's `AXIS_CHAINS`.
    chain: string;
    spans: readonly { from: string; to: string; length: number }[];
    longest: { from: string; to: string; length: number };
  }[];
  // One of the domain's `SPAN_UNITS` and `SPAN_UNIT_BASES`.
  unit: string;
  unitBasis: string;
  setAside: readonly string[];
  // One of the domain's `SPAN_REFUSALS`, or null where nothing refused it.
  refusedFor: string | null;
};

export type RuleEvaluationView = {
  provision: string;
  description: string;
  conditions: readonly { parameter: string; holds: boolean | null }[];
  excluded: boolean;
  holds: boolean;
};

export type ProvisionStandingView = {
  provision: string;
  description: string;
  titleRight: string | null;
  requirements: readonly {
    anyOf: readonly string[];
    onlyBuiltBefore: number | null;
    applies: boolean | null;
    answered: boolean;
  }[];
};

export type TitleDocumentStandingView = {
  documentId: string;
  documentType: string;
  landRight: string | null;
  dated: {
    fieldName: string;
    value: string;
    pageNumber: number | null;
    confidence: number | null;
  } | null;
  withinWindow: boolean | null;
  items: readonly {
    item: string;
    window: string;
    issuedFrom: string | null;
    issuedBefore: string | null;
    admits: boolean | null;
  }[];
};

export type PackageDetailView = PackageSummaryView & {
  files: readonly SourceFileView[];
  /*
   * What this package will take a document for, and why.
   *
   * Worked out by the same domain service the aggregate answers with, off the
   * rows this query already holds: the supply operation accepts exactly what is
   * published here, and a second rule on the read side would be a second answer
   * (COMM-80).
   */
  gaps: readonly DocumentGapView[];
  /*
   * Which provision of Article 8 the case falls under, and what it asks for.
   * Worked out on every read by the service the report was compiled with, and
   * null on a profile that declares no table of provisions (ADR-0025).
   */
  provision: ProvisionView | null;
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
