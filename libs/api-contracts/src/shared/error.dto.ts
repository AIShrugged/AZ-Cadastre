import { z } from 'zod';

export const ErrorBodySchema = z.object({
  statusCode: z.number().int(),
  code: z.string(),
  message: z.string(),
});
export type ErrorBody = z.infer<typeof ErrorBodySchema>;
