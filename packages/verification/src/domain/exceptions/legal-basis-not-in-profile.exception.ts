import { DomainException } from '@cadastre/shared';

export class LegalBasisNotInProfileException extends DomainException {
  override readonly code = 'LEGAL_BASIS_NOT_IN_PROFILE';

  constructor(
    public readonly basis: string,
    public readonly profileKey: string,
    public readonly grounds: readonly string[],
  ) {
    super(
      `Profile "${profileKey}" does not register a right founded on ` +
        `"${basis}". It is founded on: ` +
        `${grounds.length > 0 ? grounds.join(', ') : 'nothing it names'}`,
    );
  }
}
