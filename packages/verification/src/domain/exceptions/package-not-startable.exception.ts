import { DomainException } from '@cadastre/shared';

export class PackageNotStartableException extends DomainException {
  override readonly code = 'PACKAGE_NOT_STARTABLE';

  constructor(
    public readonly packageId: string,
    public readonly packageStatus: string,
  ) {
    super(
      `Package ${packageId} cannot be started while it is ${packageStatus}`,
    );
  }
}
