import { DomainException } from '@cadastre/shared';

export class InvalidApprovalCommentException extends DomainException {
  override readonly code = 'INVALID_APPROVAL_COMMENT';

  constructor(public readonly reason: 'too_long') {
    super('An approval comment is a remark, not the report itself');
  }
}
