import { DomainException } from '@cadastre/shared';

export class RegistryCheckNotInProfileException extends DomainException {
  override readonly code = 'REGISTRY_CHECK_NOT_IN_PROFILE';

  constructor(
    public readonly key: string,
    public readonly profileKey: string,
  ) {
    super(`Profile "${profileKey}" declares no registry check "${key}"`);
  }
}
