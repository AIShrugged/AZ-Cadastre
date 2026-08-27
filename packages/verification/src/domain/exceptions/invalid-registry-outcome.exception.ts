import { DomainException } from '@cadastre/shared';

export class InvalidRegistryOutcomeException extends DomainException {
  override readonly code = 'INVALID_REGISTRY_OUTCOME';

  constructor(public readonly received: string) {
    super(`"${received}" is not a registry outcome`);
  }
}
