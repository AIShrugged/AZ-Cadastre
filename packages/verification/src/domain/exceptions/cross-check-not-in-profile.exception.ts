import { DomainException } from '@cadastre/shared';

export class CrossCheckNotInProfileException extends DomainException {
  override readonly code = 'CROSS_CHECK_NOT_IN_PROFILE';

  constructor(
    public readonly key: string,
    public readonly profileKey: string,
  ) {
    super(`Profile "${profileKey}" declares no cross-check "${key}"`);
  }
}
