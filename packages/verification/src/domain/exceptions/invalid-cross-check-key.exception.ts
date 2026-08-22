import { DomainException } from '@cadastre/shared';

export class InvalidCrossCheckKeyException extends DomainException {
  override readonly code = 'INVALID_CROSS_CHECK_KEY';

  constructor(public readonly reason: 'empty' | 'too_long') {
    super(`Cross-check key is ${reason}`);
  }
}
