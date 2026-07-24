import type { PackageStatus } from "../../infrastructure/database/generated/enums.js";

export type PipelinePage = {
  id: string;
  pageNumber: number;
  imageStorageKey: string;
  /** Existing OCR text for the page, or null if it hasn't been OCR'd yet. */
  ocrText: string | null;
};

export type PipelineDocument = {
  id: string;
  originalFilename: string;
  contentType: string;
  storageKey: string;
  pages: PipelinePage[];
};

export type PipelinePackage = {
  id: string;
  profileKey: string;
  documents: PipelineDocument[];
};

/** New page to persist for a document (before OCR runs). */
export type NewPage = {
  pageNumber: number;
  imageStorageKey: string;
};

/** OCR output to persist for one page. */
export type OcrResultInput = {
  text: string;
  confidence: number;
  boxes?: unknown;
};

/**
 * Persistence port for the verification pipeline — the reads and writes its
 * activity-shaped stages need (ADR-0001). Prisma-backed in infrastructure.
 * Every write is idempotent so a stage can be safely retried.
 */
export abstract class PipelineStore {
  /** Load a package with its documents and pages (incl. any existing OCR text). */
  abstract getPackage(packageId: string): Promise<PipelinePackage | null>;
  abstract setPackageStatus(
    packageId: string,
    status: PackageStatus,
  ): Promise<void>;
  /** Create pages for a document; returns them (with null OCR text). */
  abstract createPages(
    documentId: string,
    pages: NewPage[],
  ): Promise<PipelinePage[]>;
  /** Upsert the OCR result for a page (idempotent on pageId). */
  abstract saveOcrResult(pageId: string, result: OcrResultInput): Promise<void>;
  /** Set a document's detected type (idempotent). */
  abstract setDocumentType(documentId: string, type: string): Promise<void>;
}
