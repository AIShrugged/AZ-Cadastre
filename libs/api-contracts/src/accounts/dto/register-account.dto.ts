import { z } from 'zod';

import { AccountDtoSchema } from './account.dto.js';

// The floor a password has to clear, and the ceiling it may not pass. The floor
// is a length and nothing else: a rule that demands a digit and a capital
// letter buys about as much as one more character and costs every applicant a
// refused form they cannot read.
//
// Eight and not ten, because the product's own seeded accounts are opened with
// `12345678` so that a fresh clone can be signed into with nothing configured,
// and a floor the seed cannot clear is a floor somebody lowers in a hurry on
// the day it first blocks them. A policy the system itself has to break is not
// a policy — it is a bypass waiting to be written.
//
// The ceiling is there because the hash is computed over whatever arrives, and
// an unbounded body is an unbounded amount of work for one request.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

// What a login may be. Three is the shortest thing worth typing twice; 64 is
// what bounds the column and its uniqueness index. Nothing in between is
// checked — a login is a plain string, not an address (see `AccountDtoSchema`).
export const LOGIN_MIN_LENGTH = 3;
export const LOGIN_MAX_LENGTH = 64;

// A name part — a given name or a family name. One is the floor because a
// single-letter name is somebody's; 100 is the ceiling because the column needs
// one.
export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 100;

/**
 * What an applicant sends to open an account.
 *
 * It names no role, and it cannot: this route creates a **user** and only a
 * user. An operator is the office's own account and is seeded or made by the
 * office — a registration form that could ask for the role would be a form that
 * hands out the office's own authority to anyone who reads the request shape.
 */
export const RegisterAccountRequestSchema = z.object({
  /**
   * Lower-cased and trimmed here rather than at the database, so that one
   * spelling is what the uniqueness check, the sign-in and the seed all see.
   *
   * Not `z.email()`, and never: the seeded operator is `cadastre-operator`,
   * which no address validator would accept. An applicant typing their address
   * in here gets a login that happens to look like one, and the system stores
   * and compares a string either way.
   */
  login: z
    .string()
    .trim()
    .toLowerCase()
    .min(LOGIN_MIN_LENGTH)
    .max(LOGIN_MAX_LENGTH),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  // Both required, and separate. See `AccountDtoSchema` for why there is no
  // `fullName` on the way back out.
  firstName: z.string().trim().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH),
  lastName: z.string().trim().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH),
});
export type RegisterAccountRequest = z.infer<
  typeof RegisterAccountRequestSchema
>;

export const RegisterAccountResponseSchema = AccountDtoSchema;
export type RegisterAccountResponse = z.infer<
  typeof RegisterAccountResponseSchema
>;
