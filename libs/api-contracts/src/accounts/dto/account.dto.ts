import { z } from 'zod';

import { AccountRoleSchema } from '../enums/index.js';

/**
 * An account as everybody outside the context may see it, and the only shape
 * the four auth routes ever answer with.
 *
 * The identifier is a **login** and not an address: the office's own account is
 * `cadastre-operator`, which is nobody's email. An applicant may well type an
 * address into the field — most will — but nothing here treats it as one, so
 * `aysel@example.az` and `cadastre-operator` are the same kind of thing.
 *
 * The name arrives in two fields because that is how a form asks for it. There
 * is no `fullName`: joining them is a display decision — which order, whether a
 * patronymic goes between them, what a column too narrow for both should drop —
 * and the client is where that decision belongs.
 *
 * What is deliberately absent is the credential: no hash, no salt, no
 * algorithm, no "last password change". A field nobody may read is a field that
 * does not belong in the published language — and a DTO that carried one would
 * put it in the browser bundle's type definitions as documentation of how we
 * store it.
 */
export const AccountDtoSchema = z.object({
  id: z.uuid(),
  login: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: AccountRoleSchema,
});
export type AccountDto = z.infer<typeof AccountDtoSchema>;
