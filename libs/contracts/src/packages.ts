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
  /** Documents the pipeline has classified so far — the progress signal. */
  classifiedCount: z.number().int().nonnegative(),
  /** ISO-8601 timestamps. */
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ─── Package detail (GET /api/packages/:id) ───────────────────────────────────
// The pipeline's per-document output so far: each page's OCR result and the
// document's detected type. Extracted fields / validation come in later stages.

/** OCR output for one page. */
export const OcrDtoSchema = z.object({
  text: z.string(),
  /** Page-level confidence, 0..1. */
  confidence: z.number(),
});
export type OcrDto = z.infer<typeof OcrDtoSchema>;

/** One page of a document, with its OCR result (null until OCR runs). */
export const PageDtoSchema = z.object({
  pageNumber: z.number().int().positive(),
  ocr: OcrDtoSchema.nullable(),
});
export type PageDto = z.infer<typeof PageDtoSchema>;

/** One structured field extracted from a document (PRD §4.5). */
export const FieldDtoSchema = z.object({
  /** Field key (see the type's field schema) — used for the i18n label. */
  name: z.string(),
  value: z.string(),
  confidence: z.number(),
  pageNumber: z.number().int().positive(),
});
export type FieldDto = z.infer<typeof FieldDtoSchema>;

/** A document with its pages, detected type, and extracted fields. */
export const DocumentDtoSchema = z.object({
  id: z.string(),
  originalFilename: z.string(),
  contentType: DocumentContentTypeSchema,
  type: z.string().nullable(),
  pages: z.array(PageDtoSchema),
  fields: z.array(FieldDtoSchema),
});
export type DocumentDto = z.infer<typeof DocumentDtoSchema>;

/** Full package with documents — the verification detail view. */
export const PackageDetailDtoSchema = PackageDtoSchema.extend({
  documents: z.array(DocumentDtoSchema),
});
export type PackageDetailDto = z.infer<typeof PackageDetailDtoSchema>;
export type PackageDto = z.infer<typeof PackageDtoSchema>;
