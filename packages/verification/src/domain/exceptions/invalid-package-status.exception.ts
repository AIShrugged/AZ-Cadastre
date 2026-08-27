import { DomainException } from '@cadastre/shared';

export class InvalidPackageStatusException extends DomainException {
  override readonly code = 'INVALID_PACKAGE_STATUS';

  constructor(public readonly received: string) {
    super(`"${received}" is not a verification package status`);
  }
}
