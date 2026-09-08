import { DomainException } from '@cadastre/shared';

export class ArchiveSearchAlreadyApprovedException extends DomainException {
  override readonly code = 'ARCHIVE_SEARCH_ALREADY_APPROVED';

  constructor(public readonly packageId: string) {
    super(
      `The archive search of package ${packageId} has already been approved, ` +
        `and an approval in force is a fact rather than a draft. It is spent ` +
        `by asking the register again, never overwritten`,
    );
  }
}
