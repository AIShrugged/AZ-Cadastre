import { DomainException } from '@cadastre/shared';

export class InvalidIssueKindException extends DomainException {
  override readonly code = 'INVALID_ISSUE_KIND';

  constructor(public readonly received: string) {
    super(`"${received}" is not a validation issue kind`);
  }
}

export class InvalidReportStatusException extends DomainException {
  override readonly code = 'INVALID_REPORT_STATUS';

  constructor(public readonly received: string) {
    super(`"${received}" is not a report status`);
  }
}
