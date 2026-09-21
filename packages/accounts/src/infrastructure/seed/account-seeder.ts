import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { Logger } from '@cadastre/logger';

import {
  ACCOUNTS_OPTIONS,
  DEFAULT_SEED_PASSWORD,
  type AccountsModuleOptions,
} from '../../accounts.module-defs.js';
import { LoginAlreadyTakenException } from '../../application/exceptions/index.js';
import { RegisterAccountCommand } from '../../application/use-cases/index.js';

type SeedAccount = {
  readonly login: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: 'operator' | 'user';
  readonly password: string;
  /**
   * The environment variable that replaces the published default. Named in the
   * seeder rather than looked up, because nothing under `packages/` reads
   * `process.env` — this is a string in a warning, and the warning is useless
   * without it.
   */
  readonly overriddenBy: string;
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

  /**
   * Both of them, every time. The second exists so that a fresh stand has an
   * applicant to look at the product as well as an operator: self-registration
   * is the real path onto an applicant's account and works regardless, but
   * somebody reading the README should not have to register before they can see
   * the half of the product that is not the office's.
   */
  private wanted(): readonly SeedAccount[] {
    return [
      {
        login: 'cadastre-operator',
        firstName: 'Cadastre',
        lastName: 'Operator',
        role: 'operator',
        password: this.options.seed.operatorPassword,
        overriddenBy: 'SEED_OPERATOR_PASSWORD',
      },
      {
        login: 'cadastre-user',
        firstName: 'Cadastre',
        lastName: 'Applicant',
        role: 'user',
        password: this.options.seed.userPassword,
        overriddenBy: 'SEED_USER_PASSWORD',
      },
    ];
  }

  private async seed(account: SeedAccount): Promise<void> {
    /*
     * Said out loud on every start where it is true, and with the variable's own
     * name in it. The default is what makes a fresh clone signable-into, and it
     * is published in this repository — so the one thing that must never happen
     * is a deployment carrying it without anybody noticing. A line that named no
     * variable would be a warning nobody can act on.
     */
    if (account.password === DEFAULT_SEED_PASSWORD) {
      this.logger.warn(
        'Seed account is using the published development password',
        {
          login: account.login,
          role: account.role,
          overrideWith: account.overriddenBy,
        },
      );
    }

    try {
      await this.commands.execute(
        new RegisterAccountCommand(
          account.login,
          account.password,
          account.firstName,
          account.lastName,
          account.role,
        ),
      );

      this.logger.log('Seed account created', {
        login: account.login,
        role: account.role,
      });
    } catch (error) {
      /*
       * Already there — the ordinary case on every start after the first, and
       * also what a second replica racing this one gets. Either way the account
       * exists, which is all this was for.
       */
      if (error instanceof LoginAlreadyTakenException) {
        this.logger.debug('Seed account already present', {
          login: account.login,
          role: account.role,
        });

        return;
      }

      throw error;
    }
  }
}
