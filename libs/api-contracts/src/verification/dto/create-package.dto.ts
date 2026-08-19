import { z } from 'zod';

import { PackageDtoSchema } from './package.dto.js';

export const FileInputSchema = z.object({
  originalFilename: z.string(),
  contentType: z.string(),
  storageKey: z.string(),
});
export type FileInput = z.infer<typeof FileInputSchema>;

export const CreatePackageRequestSchema = z.object({
  profileKey: z.string(),
  files: z.array(FileInputSchema),
});
export type CreatePackageRequest = z.infer<typeof CreatePackageRequestSchema>;

export const CreatePackageResponseSchema = PackageDtoSchema;
export type CreatePackageResponse = z.infer<typeof CreatePackageResponseSchema>;
