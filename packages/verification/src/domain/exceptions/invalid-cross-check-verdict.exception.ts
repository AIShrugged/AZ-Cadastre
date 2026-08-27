import { DomainException } from '@cadastre/shared';

export class InvalidCrossCheckVerdictException extends DomainException {
  override readonly code = 'INVALID_CROSS_CHECK_VERDICT';

  constructor(public readonly received: string) {
    super(`"${received}" is not a cross-check verdict`);
  }
}
