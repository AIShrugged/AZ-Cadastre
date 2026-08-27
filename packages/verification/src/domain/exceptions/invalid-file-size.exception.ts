import { DomainException } from '@cadastre/shared';

export class InvalidFileSizeException extends DomainException {
  override readonly code = 'INVALID_FILE_SIZE';

  constructor(public readonly received: number) {
    super(
      `A file size must be a positive whole number of bytes, received ${received}`,
    );
  }
}
