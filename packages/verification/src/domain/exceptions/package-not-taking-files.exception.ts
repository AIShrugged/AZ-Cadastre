import { DomainException } from '@cadastre/shared';

export class PackageNotTakingFilesException extends DomainException {
  override readonly code = 'PACKAGE_NOT_TAKING_FILES';

  constructor(
    public readonly packageId: string,
    public readonly packageStatus: string,
  ) {
    super(
      `Package ${packageId} is ${packageStatus}: the run reads the files it ` +
        `started with, so a file added now would reach no stage of it and the ` +
        `report the run is about to compile would describe a package that is ` +
        `no longer the one on file. Add it once the run has finished — the ` +
        `package is then verified afresh, with the new file in it`,
    );
  }
}
