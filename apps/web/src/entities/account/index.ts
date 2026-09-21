/**
 * account — who is using the system: the four auth routes, the session read off
 * `GET /auth/me`, and the small amount a client may decide about an account
 * (how its name is written, what its role is called).
 *
 * An entity and not a feature, because more than one surface reads it and none
 * of them owns it: the gate writes it, the shell draws it, and the route map is
 * decided by it.
 */
export type { AccountDto, AccountRole } from './model/account';
export { displayName, initials, ROLE_KEY } from './model/account';

export type { Session } from './model/session';
export { useSession } from './model/session';

export {
  useGetMeQuery,
  useRegisterAccountMutation,
  useSignInMutation,
  useSignOutMutation,
} from './api/auth-api';
