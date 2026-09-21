import { DomainException } from '@cadastre/shared';

export class InvalidAccountRoleException extends DomainException {
  override readonly code = 'INVALID_ACCOUNT_ROLE';

  constructor(value: string, allowed: readonly string[]) {
    super(`No such role: "${value}". One of: ${allowed.join(', ')}.`);
  }
}
