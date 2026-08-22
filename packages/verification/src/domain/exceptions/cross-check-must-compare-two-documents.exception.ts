import { DomainException } from '@cadastre/shared';

export class CrossCheckMustCompareTwoDocumentsException extends DomainException {
  override readonly code = 'CROSS_CHECK_MUST_COMPARE_TWO_DOCUMENTS';

  constructor(public readonly key: string) {
    super(
      `Cross-check "${key}" was recorded against fewer than two documents; ` +
        "one document's own values are not evidence about each other",
    );
  }
}
