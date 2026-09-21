import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import type {
  AccountDirectoryApi,
  AccountDto,
  LoginRequest,
  RegisterAccountRequest,
} from '@cadastre/api-contracts/accounts';

import {
  AuthenticateAccountQuery,
  GetAccountQuery,
  RegisterAccountCommand,
  toAccountDto,
} from '../use-cases/index.js';

/**
 * Implements the contract's accounts slice and does nothing else: one dispatch
 * to a use case, one mapper call. No rule lives here.
 */
@Injectable()
export class AccountDirectoryService implements AccountDirectoryApi {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  /**
   * Always a `user`. The role is written here rather than read off the request
   * because the request has no room for it — `RegisterAccountRequestSchema`
   * does not carry one, and this is the sentence that says why.
   */
  async register(request: RegisterAccountRequest): Promise<AccountDto> {
    return toAccountDto(
      await this.commands.execute(
        new RegisterAccountCommand(
          request.email,
          request.password,
          request.fullName,
          'user',
        ),
      ),
    );
  }

  async authenticate(request: LoginRequest): Promise<AccountDto> {
    return toAccountDto(
      await this.queries.execute(
        new AuthenticateAccountQuery(request.email, request.password),
      ),
    );
  }

  async findOne(id: string): Promise<AccountDto | null> {
    const account = await this.queries.execute(new GetAccountQuery(id));

    return account ? toAccountDto(account) : null;
  }
}
