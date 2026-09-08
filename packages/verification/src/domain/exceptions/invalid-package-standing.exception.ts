import { DomainException } from '@cadastre/shared';

export class InvalidPackageStandingException extends DomainException {
  override readonly code = 'INVALID_PACKAGE_STANDING';

  constructor(public readonly received: string) {
    super(`"${received}" is not a standing a submission can be in`);
  }
}
