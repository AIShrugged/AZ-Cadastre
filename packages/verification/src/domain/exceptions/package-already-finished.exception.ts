import { DomainException } from '@cadastre/shared';

export class PackageAlreadyFinishedException extends DomainException {
  override readonly code = 'PACKAGE_ALREADY_FINISHED';

  constructor(
    public readonly packageId: string,
    public readonly packageStatus: string,
  ) {
    super(`Package ${packageId} has already finished as ${packageStatus}`);
  }
}
