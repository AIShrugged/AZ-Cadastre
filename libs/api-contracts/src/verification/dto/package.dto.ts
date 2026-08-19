import { z } from 'zod';

import {
  CrossCheckVerdictSchema,
  DocumentContentTypeSchema,
  IssueKindSchema,
  PackageStatusSchema,
  ReportStatusSchema,
} from '../enums/index.js';

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
  // Null until the run has compiled a report. A report is the last thing every
  // run produces, however much of the package it managed to read.
  reportStatus: ReportStatusSchema.nullable(),
  // Findings about the package itself, and readings the engine is unsure of.
  // Counted apart: they do not add up to one number.
  issuesCount: z.number().int().nonnegative(),
  lowConfidenceCount: z.number().int().nonnegative(),
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
  // A short-lived link to the rendered sheet, so a finding can be checked
  // against the scan it was made from. Null when it could not be signed.
  imageUrl: z.string().nullable(),
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

export const IssueDtoSchema = z.object({
  kind: IssueKindSchema,
  // The audit line, written in English when the finding was made. A reader is
  // shown the finding built from the fields below, in their own language.
  message: z.string(),
  documentId: z.string().nullable(),
  sourceFileId: z.string().nullable(),
  documentType: z.string().nullable(),
  fieldName: z.string().nullable(),
  // The profile cross-check the finding came out of. Set only for
  // FieldMismatch, where the finding is about a rule rather than one field —
  // it is what names the finding to a reader in their own language.
  checkKey: z.string().nullable(),
  pageNumber: z.number().int().positive().nullable(),
  // 0..1.
  confidence: z.number().nullable(),
});
export type IssueDto = z.infer<typeof IssueDtoSchema>;

// ─── Cross-document verification ─────────────────────────────────────────────
// What the papers of one submission were asked to agree on, and whether they
// did. Reported apart from the findings as well as through them: a check that
// agreed is evidence too, and it is what the inspector does not have to redo.

export const CheckedValueDtoSchema = z.object({
  // Null once the document it was read off is gone — the value stands, the jump
  // into the register does not.
  documentId: z.string().nullable(),
  documentType: z.string(),
  fieldName: z.string(),
  value: z.string(),
  pageNumber: z.number().int().positive(),
  // How well the value itself was read, 0..1. A check is never surer than this.
  confidence: z.number(),
});
export type CheckedValueDto = z.infer<typeof CheckedValueDtoSchema>;

export const CrossCheckDtoSchema = z.object({
  // Profile cross-check key, e.g. "applicant_identity".
  key: z.string(),
  verdict: CrossCheckVerdictSchema,
  // 0..1.
  confidence: z.number(),
  // The audit line, written in English when the check was made. A reader is
  // shown the check built from the values below.
  note: z.string(),
  // In the order the profile names them: the anchor first.
  values: z.array(CheckedValueDtoSchema),
});
export type CrossCheckDto = z.infer<typeof CrossCheckDtoSchema>;

export const ReportDtoSchema = z.object({
  status: ReportStatusSchema,
  // ISO-8601.
  generatedAt: z.string(),
  issues: z.array(IssueDtoSchema),
});
export type ReportDto = z.infer<typeof ReportDtoSchema>;

export const PackageDetailDtoSchema = PackageDtoSchema.extend({
  files: z.array(SourceFileDtoSchema),
  // Empty until the cross-document stage has run, and short of the profile's
  // full list where a check had only one document to read.
  crossChecks: z.array(CrossCheckDtoSchema),
  report: ReportDtoSchema.nullable(),
});
export type PackageDetailDto = z.infer<typeof PackageDetailDtoSchema>;
