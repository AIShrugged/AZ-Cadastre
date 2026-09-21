import { ApplicationException } from '@cadastre/shared';

/**
 * A 409 and not a 400: the request is well formed and it is the world that has
 * no room for it.
 *
 * It does tell a caller that an address is in use, and that is a real cost —
 * somebody can ask this system whether a given person has an account here, one
 * request at a time. The alternative is answering 201 to a registration that
 * created nothing and letting the applicant find out at the sign-in screen,
 * which trades a fact a determined caller can get anyway for a form nobody can
 * use. Sign-in makes the opposite trade, and says so.
 */
export class EmailAlreadyTakenException extends ApplicationException {
  override readonly code = 'EMAIL_ALREADY_TAKEN';
  override readonly status = 409;

  constructor(email: string) {
    super(`An account already answers to ${email}`);
  }
}
