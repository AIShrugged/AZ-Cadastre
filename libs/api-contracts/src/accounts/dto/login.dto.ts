import { z } from 'zod';

import { AccountDtoSchema } from './account.dto.js';

/**
 * What a sign-in is made of. No length rule on either field, deliberately: the
 * credential offered is either the one on file or it is not, and refusing a
 * short password — or a login below the registration floor — before checking it
 * would tell a caller something about what this system has on file.
 */
export const LoginRequestSchema = z.object({
  /**
   * Folded the same way a registration folds it, and bounded by nothing else:
   * a login the registration schema would have refused comes back 401 here like
   * any other credential that is not somebody's, and a 400 where a wrong
   * password gets a 401 is a way to tell a login this system has never seen
   * from one it has.
   */
  login: z.string().trim().toLowerCase(),
  password: z.string(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = AccountDtoSchema;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
