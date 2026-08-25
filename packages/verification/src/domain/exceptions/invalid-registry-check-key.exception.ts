import { DomainException } from '@cadastre/shared';

export class InvalidRegistryCheckKeyException extends DomainException {
  override readonly code = 'INVALID_REGISTRY_CHECK_KEY';

  constructor(public readonly reason: 'empty' | 'too_long') {
    super(`Registry check key is ${reason}`);
  }
}
