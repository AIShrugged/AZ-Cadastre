import { DomainException } from '@cadastre/shared';

export class UnsupportedContentTypeException extends DomainException {
  override readonly code = 'UNSUPPORTED_CONTENT_TYPE';

  constructor(public readonly received: string) {
    super(`"${received}" is not a file format this system accepts`);
  }
}
