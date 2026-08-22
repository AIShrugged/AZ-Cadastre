import { DomainException } from '@cadastre/shared';

export class PackageNotUnderWayException extends DomainException {
  override readonly code = 'PACKAGE_NOT_UNDER_WAY';

  constructor(
    public readonly packageId: string,
    public readonly packageStatus: string,
  ) {
    super(
      `Package ${packageId} is ${packageStatus}, so the pipeline cannot record against it`,
    );
  }
}
