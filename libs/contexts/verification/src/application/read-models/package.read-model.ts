export type PackageSummaryView = {
  id: string;
  status: string;
  profileKey: string;
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
  originalFilename: string;
  contentType: string;
  type: string | null;
  classificationConfidence: number | null;
  pages: readonly PageView[];
  fields: readonly FieldView[];
};

export type PackageDetailView = PackageSummaryView & {
  documents: readonly DocumentView[];
};
