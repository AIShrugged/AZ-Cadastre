import {
  AccountDtoSchema,
  type AccountDto,
} from '@cadastre/api-contracts/accounts';

import type { AccountView } from '../../read-models/index.js';

/**
 * The context's view of an account, in the published language.
 *
 * Parsed on the way out rather than cast: the role is a string in here — the
 * domain's own value, folded to what it is stored as — and the contract's enum
 * is what says it is one of the two. A role this context grew and the contract
 * has not is caught here, at the one place it crosses.
 */
export function toAccountDto(view: AccountView): AccountDto {
  return AccountDtoSchema.parse(view);
}
