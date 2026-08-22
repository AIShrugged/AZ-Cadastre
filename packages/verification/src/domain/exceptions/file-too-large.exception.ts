import { DomainException } from '@cadastre/shared';

export class FileTooLargeException extends DomainException {
  override readonly code = 'FILE_TOO_LARGE';

  constructor(
    public readonly received: number,
    public readonly max: number,
  ) {
    super(
      `A file may be at most ${Math.round(max / (1024 * 1024))} MB, received ` +
        `${(received / (1024 * 1024)).toFixed(1)} MB`,
    );
  }
}
