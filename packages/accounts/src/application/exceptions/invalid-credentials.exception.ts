import { ApplicationException } from '@cadastre/shared';

/**
 * The one refusal a sign-in has, for both of the ways it can fail: a login no
 * account answers to, and the wrong password against one that exists.
 *
 * Two refusals here would be a way to enumerate this system's accounts without
 * knowing a single password. So the message says nothing either — not which
 * half was wrong, not whether the login is known.
 */
export class InvalidCredentialsException extends ApplicationException {
  override readonly code = 'INVALID_CREDENTIALS';
  override readonly status = 401;

  constructor() {
    super('Wrong login or password');
  }
}
