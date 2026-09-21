/**
 * Whether anybody is signed in, as one of four answers the app can act on.
 *
 * Four and not a boolean, because "not signed in" and "could not ask" are
 * different news and lead somewhere different: the first is the gate, the
 * second is a page that says the service did not answer. Collapsing them sends
 * a reader with a perfectly good session to the sign-in form every time the API
 * hiccups — and they would sign in, and it would work, and nobody would ever
 * find out why.
 *
 * The order the answer is read in matters and is the reason this is a function
 * rather than three flags at the call site. A refused re-ask keeps the last good
 * answer in `data`, so the refusal is looked at first: after signing out, the
 * cache still holds the account that has just gone.
 */
import type { AccountDto } from '@cadastre/api-contracts/accounts';

import { useGetMeQuery } from '../api/auth-api';

export type Session =
  /** Nothing has come back yet. The app draws neither the shell nor the gate. */
  | { readonly state: 'asking' }
  /** The service says nobody is signed in — a 401 from `me`, which is an answer. */
  | { readonly state: 'anonymous' }
  /** The service did not answer at all. Not the same as being signed out. */
  | { readonly state: 'unreachable' }
  | { readonly state: 'signed-in'; readonly account: AccountDto };

function refusedAsUnknown(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: unknown }).status === 401
  );
}

export function useSession(): {
  session: Session;
  /** Ask again — what the app does when some other call is refused. */
  refetch: () => void;
} {
  const { data, error, refetch } = useGetMeQuery();

  const session: Session = refusedAsUnknown(error)
    ? { state: 'anonymous' }
    : data !== undefined
      ? { state: 'signed-in', account: data }
      : error !== undefined
        ? { state: 'unreachable' }
        : { state: 'asking' };

  return { session, refetch };
}
