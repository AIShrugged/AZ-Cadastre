import { beforeAll, describe, expect, inject, it } from 'vitest';

import { ApiError, RestClient } from '@cadastre/api-client';
import { SESSION_COOKIE } from '@cadastre/api-gateway';

import { SEEDED_OPERATOR, SEEDED_USER } from '../harness/sign-in.js';

let baseUrl: string;

beforeAll(() => {
  baseUrl = inject('baseUrl');
});

function someone(): {
  login: string;
  password: string;
  firstName: string;
  lastName: string;
} {
  return {
    login: `applicant-${crypto.randomUUID()}`,
    password: 'long-enough',
    firstName: 'Rəşad',
    lastName: 'Məmmədov',
  };
}

/*
 * The four auth routes, over HTTP, against the real database and the real
 * hasher.
 *
 * What is worth proving here rather than in a unit test is the part a unit test
 * cannot reach: that the cookie comes back with the flags it is supposed to
 * have, that the next request carries it, and that a refusal comes out in the
 * published `ErrorBody` like every other refusal (ADR-0029).
 */
describe('POST /api/auth/register', () => {
  it('opens a user account and answers with it', async () => {
    const api = new RestClient(baseUrl);
    const applicant = someone();

    const { status, body } = await api.auth.register(applicant);

    expect(status).toBe(201);
    expect(body).toMatchObject({
      login: applicant.login,
      firstName: applicant.firstName,
      lastName: applicant.lastName,
      // Never an operator, whatever is sent: the office's own accounts are not
      // handed out by a public form.
      role: 'user',
    });
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('takes an address as an ordinary login, without validating it as one', async () => {
    const api = new RestClient(baseUrl);
    const applicant = {
      ...someone(),
      login: `Aysel.${crypto.randomUUID()}@example.az`,
    };

    const { body } = await api.auth.register(applicant);

    expect(body.login).toBe(applicant.login.toLowerCase());
  });

  it('never answers with the credential', async () => {
    const api = new RestClient(baseUrl);
    const { body } = await api.auth.register(someone());

    expect(Object.keys(body).sort()).toEqual([
      'firstName',
      'id',
      'lastName',
      'login',
      'role',
    ]);
  });

  it('does not sign the applicant in', async () => {
    const api = new RestClient(baseUrl);
    await api.auth.register(someone());

    expect(api.session).toBeNull();
    await expect(api.auth.me()).rejects.toMatchObject({ status: 401 });
  });

  it('takes a login differing only in case as the same login', async () => {
    const api = new RestClient(baseUrl);
    const applicant = someone();

    await api.auth.register(applicant);

    await expect(
      api.auth.registerRaw({
        ...applicant,
        login: applicant.login.toUpperCase(),
      }),
    ).rejects.toMatchObject({
      status: 409,
      body: { code: 'LOGIN_ALREADY_TAKEN' },
    });
  });

  it('refuses a login that is already somebody’s with 409', async () => {
    const api = new RestClient(baseUrl);
    const applicant = someone();

    await api.auth.register(applicant);

    await expect(api.auth.register(applicant)).rejects.toMatchObject({
      status: 409,
      body: { code: 'LOGIN_ALREADY_TAKEN' },
    });
  });

  it.each([
    ['no login', { password: 'long-enough', firstName: 'A', lastName: 'B' }],
    ['a login below the floor', { login: 'ab', password: 'long-enough', firstName: 'A', lastName: 'B' }], // prettier-ignore
    ['a password below the floor', { login: 'somebody', password: 'short', firstName: 'A', lastName: 'B' }], // prettier-ignore
    ['an empty first name', { login: 'somebody', password: 'long-enough', firstName: '   ', lastName: 'B' }], // prettier-ignore
    ['no last name', { login: 'somebody', password: 'long-enough', firstName: 'A' }], // prettier-ignore
  ])('refuses %s with 400', async (_case, body) => {
    const api = new RestClient(baseUrl);

    await expect(api.auth.registerRaw(body)).rejects.toMatchObject({
      status: 400,
      body: { code: 'VALIDATION_FAILED' },
    });
  });

  // Eight is the floor and the seeded accounts are opened with exactly eight,
  // so a floor that crept back up would take `docker compose up` with it.
  it('accepts a password of exactly eight characters', async () => {
    const api = new RestClient(baseUrl);

    await expect(
      api.auth.register({ ...someone(), password: '12345678' }),
    ).resolves.toMatchObject({ status: 201 });
  });
});

describe('POST /api/auth/login', () => {
  it('answers with the account and sets an httpOnly session cookie', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(SEEDED_OPERATOR),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      login: SEEDED_OPERATOR.login,
      role: 'operator',
    });

    const cookie = response.headers
      .getSetCookie()
      .find(each => each.startsWith(`${SESSION_COOKIE}=`));

    expect(cookie).toBeDefined();
    // The three that matter. `HttpOnly` is why script cannot read it,
    // `SameSite=Lax` is the whole of the CSRF defence, and `Path=/` is what
    // makes the clearing cookie on logout match this one (ADR-0029).
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);
  });

  it('carries the session into the next request', async () => {
    const api = new RestClient(baseUrl);
    await api.auth.login(SEEDED_USER);

    const { status, body } = await api.auth.me();

    expect(status).toBe(200);
    expect(body).toMatchObject({ login: SEEDED_USER.login, role: 'user' });
  });

  it('answers the same 401 for an unknown login and a wrong password', async () => {
    const api = new RestClient(baseUrl);

    const unknown = await api.auth
      .login({ login: 'nobody-at-all', password: 'whatever-it-is' })
      .catch((error: unknown) => error as ApiError);
    const wrong = await api.auth
      .login({ login: SEEDED_OPERATOR.login, password: 'not-the-password' })
      .catch((error: unknown) => error as ApiError);

    expect(unknown).toBeInstanceOf(ApiError);
    expect(wrong).toBeInstanceOf(ApiError);
    // Byte for byte the same answer: anything that told the two apart would be
    // a way to ask this system which of its logins are real.
    expect((unknown as ApiError).body).toEqual((wrong as ApiError).body);
    expect((unknown as ApiError).body).toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('refuses a login the registration form would not accept with the same 401, not a 400', async () => {
    const api = new RestClient(baseUrl);

    await expect(
      api.auth.loginRaw({ login: 'ab', password: 'x' }),
    ).rejects.toMatchObject({
      status: 401,
      body: { code: 'INVALID_CREDENTIALS' },
    });
  });

  it('signs in with the login in any case', async () => {
    const api = new RestClient(baseUrl);

    const { status } = await api.auth.login({
      ...SEEDED_USER,
      login: SEEDED_USER.login.toUpperCase(),
    });

    expect(status).toBe(200);
  });
});

describe('POST /api/auth/logout', () => {
  it('answers 204 and clears the session', async () => {
    const api = new RestClient(baseUrl);
    await api.auth.login(SEEDED_USER);

    const { status } = await api.auth.logout();

    expect(status).toBe(204);
    expect(api.session).toBeNull();
    await expect(api.auth.me()).rejects.toMatchObject({ status: 401 });
  });

  it('answers 204 with no session at all', async () => {
    const api = new RestClient(baseUrl);

    await expect(api.auth.logout()).resolves.toMatchObject({ status: 204 });
  });
});

describe('GET /api/auth/me', () => {
  it('is 401 with no session', async () => {
    const api = new RestClient(baseUrl);

    await expect(api.auth.me()).rejects.toMatchObject({
      status: 401,
      body: { code: 'UNAUTHORISED' },
    });
  });

  it('gives a registered applicant back both parts of their name', async () => {
    const api = new RestClient(baseUrl);
    const applicant = someone();

    await api.auth.register(applicant);
    await api.auth.login(applicant);

    await expect(api.auth.me()).resolves.toMatchObject({
      body: {
        login: applicant.login,
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        role: 'user',
      },
    });
  });

  it('is 401 on a forged cookie', async () => {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        cookie: `${SESSION_COOKIE}=eyJzdWIiOiJub2JvZHkifQ.forged-signature`,
      },
    });

    expect(response.status).toBe(401);
  });
});

describe('the seed', () => {
  it('put both accounts in, with the roles and names they are named for', async () => {
    const operator = new RestClient(baseUrl);
    const user = new RestClient(baseUrl);

    await operator.auth.login(SEEDED_OPERATOR);
    await user.auth.login(SEEDED_USER);

    await expect(operator.auth.me()).resolves.toMatchObject({
      body: {
        login: 'cadastre-operator',
        firstName: 'Cadastre',
        lastName: 'Operator',
        role: 'operator',
      },
    });
    await expect(user.auth.me()).resolves.toMatchObject({
      body: {
        login: 'cadastre-user',
        firstName: 'Cadastre',
        lastName: 'Applicant',
        role: 'user',
      },
    });
  });
});
