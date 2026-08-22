import { DomainException } from '@cadastre/shared';

export class UnknownProfileException extends DomainException {
  override readonly code = 'UNKNOWN_PROFILE';

  constructor(public readonly profileKey: string) {
    super(`No verification profile "${profileKey}"`);
  }
}
