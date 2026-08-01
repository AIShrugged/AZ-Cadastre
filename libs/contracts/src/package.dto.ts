import { z } from "zod";

import { DocumentContentTypeSchema } from "./content-type.dto.js";

export const PackageStatusSchema = z.enum([
  "Pending",
  "Processing",
  "Completed",
  "Failed",
]);
export type PackageStatus = z.infer<typeof PackageStatusSchema>;

export const PackageDtoSchema = z.object({
  id: z.string(),
  status: PackageStatusSchema,
  profileKey: z.string(),
  // Files the inspector uploaded. Known at submission.
  filesCount: z.number().int().nonnegative(),
  // Documents found inside those files. A file is a container, so this is 0
  // until the pipeline has read them, and may exceed filesCount.
  documentsCount: z.number().int().nonnegative(),
  classifiedCount: z.number().int().nonnegative(),
  unclassifiedCount: z.number().int().nonnegative(),
  extractedCount: z.number().int().nonnegative(),
  // ISO-8601.
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PackageDto = z.infer<typeof PackageDtoSchema>;

export const OcrDtoSchema = z.object({
  text: z.string(),
  // 0..1.
  confidence: z.number(),
});
export type OcrDto = z.infer<typeof OcrDtoSchema>;

export const PageDtoSchema = z.object({
  pageNumber: z.number().int().positive(),
  ocr: OcrDtoSchema.nullable(),
});
export type PageDto = z.infer<typeof PageDtoSchema>;

export const FieldDtoSchema = z.object({
  name: z.string(),
  value: z.string(),
  // 0..1.
  confidence: z.number(),
  pageNumber: z.number().int().positive(),
});
export type FieldDto = z.infer<typeof FieldDtoSchema>;

export const DocumentDtoSchema = z.object({
  id: z.string(),
  // The sheets of the containing file this document occupies, 1-based and
  // inclusive.
  firstPage: z.number().int().positive(),
  lastPage: z.number().int().positive(),
  type: z.string().nullable(),
  // 0..1, null until the document is classified.
  classificationConfidence: z.number().nullable(),
  fields: z.array(FieldDtoSchema),
});
export type DocumentDto = z.infer<typeof DocumentDtoSchema>;

export const SourceFileDtoSchema = z.object({
  id: z.string(),
  originalFilename: z.string(),
  contentType: DocumentContentTypeSchema,
  pages: z.array(PageDtoSchema),
  // Empty until the pipeline has read the file into the documents it holds.
  documents: z.array(DocumentDtoSchema),
});
export type SourceFileDto = z.infer<typeof SourceFileDtoSchema>;

export const PackageDetailDtoSchema = PackageDtoSchema.extend({
  files: z.array(SourceFileDtoSchema),
});
export type PackageDetailDto = z.infer<typeof PackageDetailDtoSchema>;
