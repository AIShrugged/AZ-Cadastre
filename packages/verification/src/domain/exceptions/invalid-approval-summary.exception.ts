import { DomainException } from '@cadastre/shared';

export class InvalidApprovalSummaryException extends DomainException {
  override readonly code = 'INVALID_APPROVAL_SUMMARY';

  constructor(public readonly reason: 'empty' | 'too_long') {
    super(
      reason === 'empty'
        ? 'An approval of an archive search states what the search means for ' +
            'the submission; there is nobody to attribute a blank one to'
        : 'An approval summary is a short conclusion, not the report itself',
    );
  }
}
