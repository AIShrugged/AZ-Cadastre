import { DomainException } from '@cadastre/shared';

export class ArchiveSearchNotSettledException extends DomainException {
  override readonly code = 'ARCHIVE_SEARCH_NOT_SETTLED';

  constructor(
    public readonly packageId: string,
    public readonly packageStatus: string,
  ) {
    super(
      `Package ${packageId} is ${packageStatus}: what the register answered ` +
        `is not settled, so an approval given now would cover answers the ` +
        `run is still free to replace. Approve it once the run has finished`,
    );
  }
}
