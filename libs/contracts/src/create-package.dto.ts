import { z } from "zod";

import { PackageDtoSchema } from "./package.dto.js";

export const DocumentInputSchema = z.object({
  originalFilename: z.string(),
  contentType: z.string(),
  storageKey: z.string(),
});
export type DocumentInput = z.infer<typeof DocumentInputSchema>;

export const CreatePackageRequestSchema = z.object({
  profileKey: z.string(),
  documents: z.array(DocumentInputSchema),
});
export type CreatePackageRequest = z.infer<typeof CreatePackageRequestSchema>;

export const CreatePackageResponseSchema = PackageDtoSchema;
export type CreatePackageResponse = z.infer<typeof CreatePackageResponseSchema>;
