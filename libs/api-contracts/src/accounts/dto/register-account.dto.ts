import { z } from 'zod';

import { AccountDtoSchema } from './account.dto.js';

// The floor a password has to clear, and the ceiling it may not pass. The floor
// is a length and nothing else: a rule that demands a digit and a capital
// letter buys about as much as one more character and costs every applicant a
// refused form they cannot read. The ceiling is there because the hash is
// computed over whatever arrives, and an unbounded body is an unbounded amount
// of work for one request.
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

/**
 * What an applicant sends to open an account.
 *
 * It names no role, and it cannot: this route creates a **user** and only a
 * user. An operator is the office's own account and is seeded or made by the
 * office — a registration form that could ask for the role would be a form that
 * hands out the office's own authority to anyone who reads the request shape.
 */
export const RegisterAccountRequestSchema = z.object({
  // Lower-cased here rather than at the database, so that one spelling is what
  // the uniqueness check, the sign-in and the seed all see. An address that
  // differs only in case is the same address to every mail server there is.
  email: z.email().trim().toLowerCase(),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  fullName: z.string().trim().min(1).max(200),
});
export type RegisterAccountRequest = z.infer<
  typeof RegisterAccountRequestSchema
>;

export const RegisterAccountResponseSchema = AccountDtoSchema;
export type RegisterAccountResponse = z.infer<
  typeof RegisterAccountResponseSchema
>;
