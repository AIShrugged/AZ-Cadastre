import { z } from "zod";

import { DocumentContentTypeSchema } from "./documents.js";

/**
 * Verification Package contracts shared by web and core. Mirrors the API DTOs
 * the `packages` controller speaks — never the domain model (ADR-0004).
 */

/** Pipeline lifecycle status of a package. */
export const PackageStatusSchema = z.enum([
  "Pending",
  "Processing",
  "Completed",
  "Failed",
]);
export type PackageStatus = z.infer<typeof PackageStatusSchema>;

/** One already-uploaded document to attach to a new package. */
export const DocumentInputSchema = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  contentType: DocumentContentTypeSchema,
  /** Object-store key returned by the presign step. */
  storageKey: z.string().trim().min(1).max(1024),
});
export type DocumentInput = z.infer<typeof DocumentInputSchema>;

/** `POST /api/packages` request body. */
export const CreatePackageRequestSchema = z.object({
  profileKey: z.string().trim().min(1).max(64),
  documents: z.array(DocumentInputSchema).min(1),
});
export type CreatePackageRequest = z.infer<typeof CreatePackageRequestSchema>;

/** Package summary as `GET /api/packages` and `POST /api/packages` return it. */
export const PackageDtoSchema = z.object({
  id: z.string(),
  status: PackageStatusSchema,
  profileKey: z.string(),
  documentsCount: z.number().int().nonnegative(),
  /** ISO-8601 timestamps. */
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PackageDto = z.infer<typeof PackageDtoSchema>;
