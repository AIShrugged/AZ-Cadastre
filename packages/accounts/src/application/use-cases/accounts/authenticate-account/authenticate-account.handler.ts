import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import { Email } from '../../../../domain/value-objects/index.js';
import { InvalidCredentialsException } from '../../../exceptions/index.js';
import {
  AccountRepository,
  PasswordHasher,
} from '../../../ports/outbound/index.js';
import { toAccountView, type AccountView } from '../../../read-models/index.js';

import { AuthenticateAccountQuery } from './authenticate-account.query.js';

@QueryHandler(AuthenticateAccountQuery)
export class AuthenticateAccountHandler implements IQueryHandler<
  AuthenticateAccountQuery,
  AccountView
> {
  constructor(
    @Inject(AccountRepository) private readonly accounts: AccountRepository,
    @Inject(PasswordHasher) private readonly passwords: PasswordHasher,
  ) {}

  async execute(query: AuthenticateAccountQuery): Promise<AccountView> {
    /*
     * An address the schema refuses is a wrong credential like any other, and
     * not a 400: `POST /auth/login` answers 401 to everything that is not a
     * sign-in, so that the shape of what was sent tells a caller nothing about
     * what is on file.
     */
    const email = Email.safe(query.email);

    if (!email) throw new InvalidCredentialsException();

    const account = await this.accounts.findByEmail(email);

    /*
     * The hash is computed even when no account answers to the address, over a
     * digest of our own. Without it the two cases take measurably different
     * times — a miss returns as fast as one index read, a hit takes the
     * hasher's whole cost — and a caller with a stopwatch gets the answer that
     * `InvalidCredentialsException` exists to withhold.
     */
    if (!account) {
      await this.passwords.verify(
        this.passwords.unmatchableHash,
        query.password,
      );
      throw new InvalidCredentialsException();
    }

    const correct = await this.passwords.verify(
      account.passwordHash,
      query.password,
    );

    if (!correct) throw new InvalidCredentialsException();

    return toAccountView(account);
  }
}
