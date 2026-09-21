import { Inject, Injectable } from '@nestjs/common';

import {
  ConcurrencyConflictException,
  DomainEventPublisher,
} from '@cadastre/shared';

import { LoginAlreadyTakenException } from '../../application/exceptions/index.js';
import { AccountRepository } from '../../application/ports/outbound/index.js';
import type { Account } from '../../domain/aggregates/index.js';
import type { AccountId, Login } from '../../domain/value-objects/index.js';

import { AccountMapper } from './account.mapper.js';
import { AccountsPrismaService } from './accounts-prisma.service.js';
import { isStoredId } from './stored-id.js';

const FIRST_STORED_VERSION = 1;

// Prisma's code for a unique constraint. The only one this table can raise is
// the index on `login`.
const UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class AccountRepositoryAdapter extends AccountRepository {
  constructor(
    @Inject(AccountsPrismaService)
    private readonly prisma: AccountsPrismaService,
    @Inject(DomainEventPublisher) private readonly events: DomainEventPublisher,
  ) {
    super();
  }

  async findById(id: AccountId): Promise<Account | null> {
    // An id that is not a uuid is nobody's account, and asking Postgres about
    // it is a driver error rather than an empty answer. It arrives from a
    // session cookie, which is a string the caller chose.
    if (!isStoredId(id)) return null;

    const row = await this.prisma.account.findUnique({
      where: { id: id.value },
    });

    return row ? AccountMapper.toDomain(row) : null;
  }

  async findByLogin(login: Login): Promise<Account | null> {
    const row = await this.prisma.account.findUnique({
      where: { login: login.value },
    });

    return row ? AccountMapper.toDomain(row) : null;
  }

  async save(account: Account): Promise<void> {
    const row = AccountMapper.toRow(account);
    const loadedAt = account.version;

    try {
      if (loadedAt === 0) {
        await this.prisma.account.create({
          data: { ...row, version: FIRST_STORED_VERSION },
        });
      } else {
        /*
         * The version is in the WHERE clause and bumped by the write, so a
         * concurrent update is refused rather than silently overwritten — the
         * same optimistic scheme the other context uses, and the reason the
         * count is checked rather than the row.
         */
        const { count } = await this.prisma.account.updateMany({
          where: { id: row.id, version: loadedAt },
          data: { ...row, version: loadedAt + 1 },
        });

        if (count === 0) {
          throw new ConcurrencyConflictException('Account', row.id, loadedAt);
        }
      }
    } catch (error) {
      /*
       * Two registrations for one login that arrive together both read
       * nothing in the use case, and one of them loses here. It is the same
       * refusal the use case would have raised, so it is spelt the same way:
       * the index is what decides, and the read before it is only there to make
       * the ordinary case say something readable.
       */
      if (isUniqueViolation(error)) {
        throw new LoginAlreadyTakenException(row.login);
      }
      throw error;
    }

    // Published after the write and outside it, so a subscriber finds the row
    // already there. The same order, and the same gap, as next door
    // (TECH_DEBT §1).
    await this.events.dispatch(account);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}
