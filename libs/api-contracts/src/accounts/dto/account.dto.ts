import { z } from 'zod';

import { AccountRoleSchema } from '../enums/index.js';

/**
 * An account as everybody outside the context may see it, and the only shape
 * the four auth routes ever answer with.
 *
 * What is deliberately absent is the credential: no hash, no salt, no
 * algorithm, no "last password change". A field nobody may read is a field that
 * does not belong in the published language — and a DTO that carried one would
 * put it in the browser bundle's type definitions as documentation of how we
 * store it.
 */
export const AccountDtoSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  fullName: z.string(),
  role: AccountRoleSchema,
});
export type AccountDto = z.infer<typeof AccountDtoSchema>;
