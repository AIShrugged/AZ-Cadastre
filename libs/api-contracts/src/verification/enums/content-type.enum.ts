import { z } from 'zod';

export const DocumentContentTypeSchema = z.enum([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);
export type DocumentContentType = z.infer<typeof DocumentContentTypeSchema>;
