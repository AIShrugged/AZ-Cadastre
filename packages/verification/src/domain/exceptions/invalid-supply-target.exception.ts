import { DomainException } from '@cadastre/shared';

export class InvalidSupplyTargetException extends DomainException {
  override readonly code = 'INVALID_SUPPLY_TARGET';

  constructor(public readonly type: string) {
    super(
      `"${type}" is not a document type a file can be sent in for: it is what ` +
        `the reader answers when it cannot place a paper, so no arrival could ` +
        `ever satisfy it`,
    );
  }
}
