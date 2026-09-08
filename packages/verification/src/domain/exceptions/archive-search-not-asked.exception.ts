import { DomainException } from '@cadastre/shared';

export class ArchiveSearchNotAskedException extends DomainException {
  override readonly code = 'ARCHIVE_SEARCH_NOT_ASKED';

  constructor(public readonly packageId: string) {
    super(
      `Package ${packageId} put no question to the archive register — its ` +
        `profile asks the register nothing, or no sheet stated the value a ` +
        `check needed — so there is no archive search to approve`,
    );
  }
}
