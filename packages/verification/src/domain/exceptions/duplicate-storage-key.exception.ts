import { DomainException } from '@cadastre/shared';

export class DuplicateStorageKeyException extends DomainException {
  override readonly code = 'DUPLICATE_STORAGE_KEY';

  constructor(public readonly storageKey: string) {
    super(`Two files in the package point at the same object: ${storageKey}`);
  }
}
