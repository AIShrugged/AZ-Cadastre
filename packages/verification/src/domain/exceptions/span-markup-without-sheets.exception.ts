import { DomainException } from '@cadastre/shared';

export class SpanMarkupWithoutSheetsException extends DomainException {
  override readonly code = 'SPAN_MARKUP_WITHOUT_SHEETS';

  constructor() {
    super(
      'A span markup states at least one marked-up sheet; a document nothing ' +
        'could be drawn for carries no markup at all',
    );
  }
}
