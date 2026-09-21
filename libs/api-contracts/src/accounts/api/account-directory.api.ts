import type {
  AccountDto,
  LoginRequest,
  RegisterAccountRequest,
} from '../dto/index.js';

/**
 * What the accounts context offers about the people who use the system. Both
 * sides of every call import this: the context's service implements it, the
 * gateway's client port mirrors it, and the compiler keeps them the same shape.
 *
 * There is no session in here and there is not meant to be one. A session is
 * how a browser carries the answer to `authenticate` from one request to the
 * next — a cookie, its lifetime and its flags — and that is transport. This
 * context answers who somebody is; the edge decides how that answer travels.
 */
export interface AccountDirectoryApi {
  /**
   * Opens an account for an applicant. Always a `user`: the role is not the
   * caller's to choose (see `RegisterAccountRequestSchema`).
   *
   * Refused with `LOGIN_ALREADY_TAKEN` where an account already answers to that
   * login — a 409, because the request is well formed and it is the world that
   * has no room for it.
   */
  register(request: RegisterAccountRequest): Promise<AccountDto>;

  /**
   * Whether these credentials are somebody's, and whose.
   *
   * Refused with `INVALID_CREDENTIALS` and nothing else — the same refusal for
   * a login no account answers to and for the wrong password against one that
   * exists. Two refusals here would be a way to ask this system which of its
   * logins are real, one request at a time.
   */
  authenticate(request: LoginRequest): Promise<AccountDto>;

  /**
   * The account behind an id, or `null` where there is none.
   *
   * `null` rather than a refusal: the caller is the edge holding a session, and
   * an account that has been removed since it was issued is a session to drop,
   * not an error to serve.
   */
  findOne(id: string): Promise<AccountDto | null>;
}
