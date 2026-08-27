import { DomainException } from '@cadastre/shared';

export class PackageMustHaveAFileException extends DomainException {
  override readonly code = 'PACKAGE_MUST_HAVE_A_FILE';

  constructor() {
    super('A verification package must contain at least one file');
  }
}
