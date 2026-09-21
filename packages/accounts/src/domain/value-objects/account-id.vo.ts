import { EntityId } from '@cadastre/shared';

export class AccountId extends EntityId {
  // `__type` makes the id nominal: without it every id satisfies every
  // signature.
  declare private readonly __type: 'AccountId';

  static of(value: string): AccountId {
    return new AccountId(value);
  }
}
