import type { Account } from '../../../domain/aggregates/index.js';
import type { AccountId, Email } from '../../../domain/value-objects/index.js';

/**
 * Where accounts are kept, said in the aggregate's own words.
 *
 * `save` takes the whole aggregate rather than a diff: the aggregate is the
 * transactional boundary, and what it costs to write it is the adapter's
 * problem.
 */
export abstract class AccountRepository {
  abstract save(account: Account): Promise<void>;

  abstract findById(id: AccountId): Promise<Account | null>;

  /**
   * The address is what an account is found by, so this is the sign-in's own
   * read and the only other one there is.
   */
  abstract findByEmail(email: Email): Promise<Account | null>;
}
