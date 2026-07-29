import { z } from "zod";

import { DocumentContentTypeSchema } from "./content-type.dto.js";

export const PresignRequestSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
});
export type PresignRequest = z.infer<typeof PresignRequestSchema>;

export const PresignResponseSchema = z.object({
  key: z.string(),
  url: z.string(),
  contentType: DocumentContentTypeSchema,
  // Seconds.
  expiresIn: z.number().int().positive(),
});
export type PresignResponse = z.infer<typeof PresignResponseSchema>;
