import { DomainException } from '@cadastre/shared';

export class PageAlreadyRecognisedException extends DomainException {
  override readonly code = 'PAGE_ALREADY_RECOGNISED';

  constructor(public readonly pageId: string) {
    super(`Page ${pageId} has already been recognised`);
  }
}
