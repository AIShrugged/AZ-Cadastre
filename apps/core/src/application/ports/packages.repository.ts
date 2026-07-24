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
  createdAt: Date;
  updatedAt: Date;
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
}
