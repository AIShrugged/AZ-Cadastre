import { RestClient } from '@cadastre/api-client';

/**
 * The office's seeded account, and the password the harness starts the server
 * with. Written in both places rather than shared through a module the server
 * also reads: what this set proves is that the seed put an account in the
 * database that these credentials open, and a constant both sides imported
 * would prove they agree with each other.
 *
 * The password is the harness's own and not the published development default,
 * so these specs go on proving that `SEED_OPERATOR_PASSWORD` is still the thing
 * that decides it.
 */
export const SEEDED_OPERATOR = {
  login: 'cadastre-operator',
  password: 'operator-api-test-password',
} as const;

export const SEEDED_USER = {
  login: 'cadastre-user',
  password: 'user-api-test-password',
} as const;

/** A client signed in as the office. */
export async function asOperator(baseUrl: string): Promise<RestClient> {
  const api = new RestClient(baseUrl);
  await api.auth.login(SEEDED_OPERATOR);

  return api;
}

/** A client signed in as the seeded applicant. */
export async function asUser(baseUrl: string): Promise<RestClient> {
  const api = new RestClient(baseUrl);
  await api.auth.login(SEEDED_USER);

  return api;
}

/**
 * A client signed in as an applicant nobody else in the set shares.
 *
 * Registered rather than seeded, because what most of these cases are about is
 * one applicant not seeing another's submissions, and two specs sharing one
 * account would be two specs that pass by accident.
 */
export async function asNewUser(baseUrl: string): Promise<RestClient> {
  const api = new RestClient(baseUrl);
  const login = `applicant-${crypto.randomUUID()}`;
  const password = 'a-password-long-enough';

  await api.auth.register({
    login,
    password,
    firstName: 'Test',
    lastName: 'Applicant',
  });
  await api.auth.login({ login, password });

  return api;
}

/**
 * The session a signed-in client is carrying, as a header.
 *
 * For the handful of cases that read a response off the wire rather than
 * through the client — a body the published schema would strip, a status the
 * client turns into a throw. They still need the session, because everything
 * under `/api` does (ADR-0029).
 */
export function sessionHeader(api: RestClient): Record<string, string> {
  const session = api.session;

  if (session === null) throw new Error('That client is not signed in');

  return { cookie: session };
}
