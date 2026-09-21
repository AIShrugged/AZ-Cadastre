/**
 * Account — who is signed in, and what that lets them see.
 *
 * The contract publishes `{ id, login, firstName, lastName, role }` and no
 * display name, on purpose: joining the two parts is a display decision — which
 * order, what a band too narrow for both should drop — and this is where that
 * decision belongs. So the joining is here, once, rather than in each of the
 * three places a name is drawn.
 *
 * What is deliberately **not** here is any table of what a role may do. The
 * server decides that and answers 403 or 404 when it is asked otherwise
 * (ADR-0029); a copy of the table on the client would be a second opinion, and
 * the day the two disagree the screen is the one that is wrong. All this client
 * decides is which map a role is shown (`app/routes.tsx`) — which is a
 * different question: not what is allowed, but what is worth offering.
 */
import type { AccountDto } from '@cadastre/api-contracts/accounts';

export type { AccountDto, AccountRole } from '@cadastre/api-contracts/accounts';

/** The word for the job somebody does here, in the reader's language. */
export const ROLE_KEY = {
  operator: 'role.operator',
  user: 'role.user',
} as const;

/**
 * The name to put on the card. Given name then family name, which is the order
 * all three of this product's languages read one in.
 *
 * A name is never empty — the contract requires both parts — but a session that
 * somehow carries neither falls back to the login rather than to a blank band,
 * because an account card with nothing on it looks like a bug in the shell.
 */
export function displayName(account: AccountDto): string {
  const name = `${account.firstName} ${account.lastName}`.trim();
  return name === '' ? account.login : name;
}

/** The two letters the collapsed sidebar rail has room for. */
export function initials(account: AccountDto): string {
  const letters = [account.firstName, account.lastName]
    .map(part => [...part.trim()][0] ?? '')
    .join('');
  return (letters === '' ? account.login.slice(0, 2) : letters).toUpperCase();
}
