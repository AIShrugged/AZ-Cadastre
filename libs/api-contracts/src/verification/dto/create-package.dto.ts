import { z } from 'zod';

import { DeclaredAtIntakeDtoSchema, PackageDtoSchema } from './package.dto.js';

export const FileInputSchema = z.object({
  originalFilename: z.string(),
  contentType: z.string(),
  storageKey: z.string(),
});
export type FileInput = z.infer<typeof FileInputSchema>;

/**
 * What the office declares at the counter, as it writes it: either figure may
 * be left out, and leaving both out is the same submission this endpoint has
 * always taken.
 *
 * Optional rather than nullable-and-required so a caller written before intake
 * declared anything still parses — nothing about the papers has changed, only
 * what the office is now able to say about them alongside.
 */
export const DeclaredAtIntakeInputSchema = z.object({
  legalBasis: DeclaredAtIntakeDtoSchema.shape.legalBasis.optional(),
  builtYear: DeclaredAtIntakeDtoSchema.shape.builtYear.optional(),
});
export type DeclaredAtIntakeInput = z.infer<typeof DeclaredAtIntakeInputSchema>;

export const CreatePackageRequestSchema = z.object({
  /**
   * The profile this submission is filed under. The operator's own choice, and
   * final: `GET /profiles/suggestion` will say which profile the declaration
   * below points at and why, but it recommends and never decides — a screen
   * that submitted the suggestion instead of the choice would be a screen
   * nobody could disagree with.
   */
  profileKey: z.string(),
  files: z.array(FileInputSchema),
  // What the office declares about the case, kept apart from what the pipeline
  // will read off the papers. Absent is the same as declaring neither figure.
  declared: DeclaredAtIntakeInputSchema.optional(),
});
export type CreatePackageRequest = z.infer<typeof CreatePackageRequestSchema>;

export const CreatePackageResponseSchema = PackageDtoSchema;
export type CreatePackageResponse = z.infer<typeof CreatePackageResponseSchema>;
