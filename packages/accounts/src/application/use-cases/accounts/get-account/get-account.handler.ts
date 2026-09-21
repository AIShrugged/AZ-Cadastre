import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import { AccountId } from '../../../../domain/value-objects/index.js';
import { AccountRepository } from '../../../ports/outbound/index.js';
import { toAccountView, type AccountView } from '../../../read-models/index.js';

import { GetAccountQuery } from './get-account.query.js';

@QueryHandler(GetAccountQuery)
export class GetAccountHandler implements IQueryHandler<
  GetAccountQuery,
  AccountView | null
> {
  constructor(
    @Inject(AccountRepository) private readonly accounts: AccountRepository,
  ) {}

  async execute(query: GetAccountQuery): Promise<AccountView | null> {
    const account = await this.accounts.findById(AccountId.of(query.accountId));

    return account ? toAccountView(account) : null;
  }
}
