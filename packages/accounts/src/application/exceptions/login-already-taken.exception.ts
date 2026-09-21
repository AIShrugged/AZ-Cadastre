import { ApplicationException } from '@cadastre/shared';

/**
 * A 409 and not a 400: the request is well formed and it is the world that has
 * no room for it.
 *
 * It does tell a caller that a login is in use, and that is a real cost —
 * somebody can ask this system whether a given login has an account here, one
 * request at a time. The alternative is answering 201 to a registration that
 * created nothing and letting the applicant find out at the sign-in screen,
 * which trades a fact a determined caller can get anyway for a form nobody can
 * use. Sign-in makes the opposite trade, and says so.
 */
export class LoginAlreadyTakenException extends ApplicationException {
  override readonly code = 'LOGIN_ALREADY_TAKEN';
  override readonly status = 409;

  constructor(login: string) {
    super(`An account already answers to ${login}`);
  }
}
