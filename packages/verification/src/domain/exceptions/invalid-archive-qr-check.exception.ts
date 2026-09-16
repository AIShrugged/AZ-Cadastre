import { DomainException } from '@cadastre/shared';

export class InvalidArchiveQrCheckException extends DomainException {
  override readonly code = 'INVALID_ARCHIVE_QR_CHECK';

  constructor(public readonly reason: string) {
    super(`Not an archive QR check: ${reason}`);
  }
}
