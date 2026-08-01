export type PackageSummaryView = {
  id: string;
  status: string;
  profileKey: string;
  filesCount: number;
  documentsCount: number;
  classifiedCount: number;
  unclassifiedCount: number;
  extractedCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type OcrView = {
  text: string;
  // 0..1.
  confidence: number;
};

export type PageView = {
  pageNumber: number;
  ocr: OcrView | null;
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
};
