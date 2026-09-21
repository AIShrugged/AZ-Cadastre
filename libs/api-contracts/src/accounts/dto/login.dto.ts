import { z } from 'zod';

import { AccountDtoSchema } from './account.dto.js';

/**
 * What a sign-in is made of. No length rule on the password, deliberately: the
 * credential offered is either the one on file or it is not, and refusing a
 * short one before checking it would tell a caller that no account here was
 * ever opened with a password that short.
 */
export const LoginRequestSchema = z.object({
  /**
   * Not `z.email()`, and that is the point: an address the schema refused would
   * come back 400 from the edge, and a 400 where a wrong password gets a 401 is
   * a way to tell an address this system has never seen from one it has. The
   * context reads it and answers the one refusal a sign-in has.
   */
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = AccountDtoSchema;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
