import { z } from "zod";

import { DocumentContentTypeSchema } from "../enums/index.js";

export const PresignRequestSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  // Bytes. What the browser says it is about to PUT — the storage rule is
  // checked before a URL is signed rather than after the bytes are spent.
  size: z.number().int().positive(),
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
