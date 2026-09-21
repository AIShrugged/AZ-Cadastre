import { z } from 'zod';

/**
 * What an account may do, as two roles and never a list of permissions.
 *
 * - `operator` is the office: everything the API does — intake, the whole
 *   register of cases, the archive search and its approval, the overview.
 * - `user` is the applicant: they submit a package, see their own submissions
 *   and nothing else, and send in a document one of them is short of.
 *
 * Two values and not a scale: a role here is a job somebody has, and the table
 * of who may call what is written against the job. A third role is a change to
 * that table and to this enum together, which is what keeps the two from
 * drifting apart.
 */
export const AccountRoleSchema = z.enum(['operator', 'user']);
export type AccountRole = z.infer<typeof AccountRoleSchema>;
