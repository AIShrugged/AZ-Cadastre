import { DomainException } from '@cadastre/shared';

export class InvalidConfidenceException extends DomainException {
  override readonly code = 'INVALID_CONFIDENCE';

  constructor(public readonly received: number) {
    super(`Confidence must be a number between 0 and 1, received ${received}`);
  }
}
