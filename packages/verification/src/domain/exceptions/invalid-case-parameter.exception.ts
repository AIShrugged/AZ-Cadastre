import { DomainException } from '@cadastre/shared';

/**
 * An operator stated a figure the parameter cannot take: a year outside the
 * window a paper can be dated in, a count or a measurement that is not
 * positive, or a word that is no `LandRight` or `LandPurpose`.
 *
 * A malformed ask and never a conflict — no state of the package would make
 * "nought storeys" a case — so the edge answers it 400, the same as a key no
 * schema declares.
 */
export class InvalidCaseParameterException extends DomainException {
  override readonly code = 'INVALID_CASE_PARAMETER';

  constructor(
    public readonly parameter: string,
    public readonly value: number | string,
  ) {
    super(`"${value}" is not a ${parameter} a case can be decided on`);
  }
}
