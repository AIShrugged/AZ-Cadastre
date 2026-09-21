import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { Account } from '../../../../domain/aggregates/index.js';
import {
  AccountRole,
  Login,
  PersonName,
} from '../../../../domain/value-objects/index.js';
import { LoginAlreadyTakenException } from '../../../exceptions/index.js';
import {
  AccountRepository,
  IdGenerator,
  PasswordHasher,
} from '../../../ports/outbound/index.js';
import { toAccountView, type AccountView } from '../../../read-models/index.js';

import { RegisterAccountCommand } from './register-account.command.js';

@CommandHandler(RegisterAccountCommand)
export class RegisterAccountHandler implements ICommandHandler<
  RegisterAccountCommand,
  AccountView
> {
  constructor(
    @Inject(AccountRepository) private readonly accounts: AccountRepository,
    @Inject(PasswordHasher) private readonly passwords: PasswordHasher,
    @Inject(IdGenerator) private readonly ids: IdGenerator,
  ) {}

  async execute(command: RegisterAccountCommand): Promise<AccountView> {
    const login = Login.create(command.login);

    /*
     * Asked before writing, and the unique index on the column is what actually
     * decides it: two registrations for one login that arrive together both
     * read nothing here, and one of them then loses at the index. This read
     * exists so the ordinary case — somebody who registered last week — gets
     * the refusal that says what happened instead of a constraint violation,
     * and the adapter turns the losing race into the same refusal.
     */
    if (await this.accounts.findByLogin(login)) {
      throw new LoginAlreadyTakenException(login.value);
    }

    const account = Account.register(
      this.ids.accountId(),
      login,
      PersonName.create(command.firstName, command.lastName),
      AccountRole.named(command.role),
      await this.passwords.hash(command.password),
    );

    await this.accounts.save(account);

    /*
     * The aggregate itself, projected, rather than a second read of what was
     * just written: an account has no read model beyond its own few columns,
     * so a round trip here would buy nothing but a chance for the row to be
     * missing.
     */
    return toAccountView(account);
  }
}
