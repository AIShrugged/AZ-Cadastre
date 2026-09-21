import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { Logger } from '@cadastre/logger';

import {
  ACCOUNTS_OPTIONS,
  type AccountsModuleOptions,
} from '../../accounts.module-defs.js';
import { EmailAlreadyTakenException } from '../../application/exceptions/index.js';
import { RegisterAccountCommand } from '../../application/use-cases/index.js';

type SeedAccount = {
  readonly email: string;
  readonly fullName: string;
  readonly role: 'operator' | 'user';
  readonly password: string | undefined;
};

/**
 * The two accounts the office starts with, so that a stack brought up from
 * nothing can be signed into.
 *
 * At start-up rather than as a `db:seed` script, and deliberately: the register
 * next door seeds records, which are data somebody may want to edit, and this
 * seeds the ability to log in at all. A stand where the migration ran and the
 * seed did not is a stand nobody can open, and the difference between the two
 * is one command somebody forgot — so there is no command.
 *
 * Idempotent by leaving an existing account alone. Not by resetting its
 * password to whatever the environment now says: that would make the
 * environment the authority over a credential somebody may have changed, and
 * would re-open an account every restart that the office had deliberately
 * changed the password of.
 */
@Injectable()
export class AccountSeeder implements OnApplicationBootstrap {
  private readonly logger: Logger;

  constructor(
    @Inject(ACCOUNTS_OPTIONS) private readonly options: AccountsModuleOptions,
    private readonly commands: CommandBus,
    @Inject(Logger) logger: Logger,
  ) {
    this.logger = logger.child({ scope: AccountSeeder.name });
  }

  async onApplicationBootstrap(): Promise<void> {
    for (const account of this.wanted()) {
      await this.seed(account);
    }
  }

  private wanted(): readonly SeedAccount[] {
    return [
      {
        email: 'operator@cadastre.az',
        fullName: 'Cadastre Operator',
        role: 'operator',
        password: this.options.seed.operatorPassword,
      },
      {
        email: 'user@cadastre.az',
        fullName: 'Cadastre Applicant',
        role: 'user',
        password: this.options.seed.userPassword,
      },
    ];
  }

  private async seed(account: SeedAccount): Promise<void> {
    if (account.password === undefined || account.password === '') {
      // Said out loud, with the variable's own name in it: a stand nobody can
      // sign into is otherwise diagnosed at the login screen.
      this.logger.warn('Seed account not created: no password configured', {
        email: account.email,
        role: account.role,
      });

      return;
    }

    try {
      await this.commands.execute(
        new RegisterAccountCommand(
          account.email,
          account.password,
          account.fullName,
          account.role,
        ),
      );

      this.logger.log('Seed account created', {
        email: account.email,
        role: account.role,
      });
    } catch (error) {
      /*
       * Already there — the ordinary case on every start after the first, and
       * also what a second replica racing this one gets. Either way the account
       * exists, which is all this was for.
       */
      if (error instanceof EmailAlreadyTakenException) {
        this.logger.debug('Seed account already present', {
          email: account.email,
          role: account.role,
        });

        return;
      }

      throw error;
    }
  }
}
