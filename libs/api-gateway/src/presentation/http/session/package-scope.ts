import type { AccountDto } from '@cadastre/api-contracts/accounts';
import type { PackageScope } from '@cadastre/api-contracts/verification';

/**
 * Whose submissions this caller may see: their own if they are an applicant,
 * every one the office holds if they are the office.
 *
 * The one place the session becomes a scope, so the rule is written once. A
 * controller that worked it out inline would be a controller somebody could get
 * backwards in one route and nowhere else.
 */
export function scopeFor(account: AccountDto): PackageScope {
  return account.role === 'operator' ? null : { ownerAccountId: account.id };
}
