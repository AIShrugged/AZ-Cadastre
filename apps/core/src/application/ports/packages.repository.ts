import type { PackageStatus } from "../../infrastructure/database/generated/enums.js";

/** One document to attach to a new package (already uploaded to storage). */
export type NewDocument = {
  originalFilename: string;
  contentType: string;
  /** Object-store key returned by the presign step. */
  storageKey: string;
};

export type CreatePackageInput = {
  profileKey: string;
  documents: NewDocument[];
};

/** A package summary as the register/dashboard needs it. */
export type PackageSummary = {
  id: string;
  status: PackageStatus;
  profileKey: string;
  documentsCount: number;
  /** Documents classified so far (type assigned) — pipeline progress. */
  classifiedCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/** One page of a document in the detail view. */
export type PackagePageDetail = {
  pageNumber: number;
  ocr: { text: string; confidence: number } | null;
};

/** A document with its pages and detected type, for the detail view. */
export type PackageDocumentDetail = {
  id: string;
  originalFilename: string;
  contentType: string;
  type: string | null;
  pages: PackagePageDetail[];
};

/** A package plus its documents — the verification detail. */
export type PackageDetail = PackageSummary & {
  documents: PackageDocumentDetail[];
};

/**
 * Persistence port for Verification Packages. The domain/api layers depend on
 * this abstraction; the Prisma-backed implementation lives in infrastructure
 * (ADR-0004).
 */
export abstract class PackagesRepository {
  /** Create a package and its documents atomically; returns the summary. */
  abstract create(input: CreatePackageInput): Promise<PackageSummary>;
  /** List packages, newest first. */
  abstract list(): Promise<PackageSummary[]>;
  /** Load one package with its documents/pages/OCR, or null if absent. */
  abstract findDetail(id: string): Promise<PackageDetail | null>;
}
