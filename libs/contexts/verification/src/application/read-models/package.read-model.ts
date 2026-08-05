export type PackageSummaryView = {
  id: string;
  status: string;
  profileKey: string;
  filesCount: number;
  documentsCount: number;
  classifiedCount: number;
  unclassifiedCount: number;
  extractedCount: number;
  // Null until the run has compiled a report.
  reportStatus: string | null;
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
  report: ReportView | null;
};
