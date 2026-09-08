import { DomainException } from '@cadastre/shared';

export class PackageMustGainAFileException extends DomainException {
  override readonly code = 'PACKAGE_MUST_GAIN_A_FILE';

  constructor(public readonly packageId: string) {
    super(
      `Adding files to package ${packageId} needs at least one file: adding ` +
        `none would discard the report it has and verify it again for nothing`,
    );
  }
}
