import { z } from "zod";

/**
 * Document upload contracts — the presign handshake shared by web and core.
 * Schemas are the single source of truth; inferred types travel with them.
 */

/** Upload MIME types the system accepts (PDF + the two image formats). */
export const DocumentContentTypeSchema = z.enum([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
export type DocumentContentType = z.infer<typeof DocumentContentTypeSchema>;

/** `POST /api/documents/presign` request body. */
export const PresignRequestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: DocumentContentTypeSchema,
});
export type PresignRequest = z.infer<typeof PresignRequestSchema>;

/** `POST /api/documents/presign` response. */
export const PresignResponseSchema = z.object({
  /** Object key the file will live under in the bucket. */
  key: z.string(),
  /** URL the browser PUTs the bytes to. */
  url: z.string(),
  /** Content-Type the browser MUST send on the PUT to match the signature. */
  contentType: DocumentContentTypeSchema,
  /** Seconds until the URL expires. */
  expiresIn: z.number().int().positive(),
});
export type PresignResponse = z.infer<typeof PresignResponseSchema>;
