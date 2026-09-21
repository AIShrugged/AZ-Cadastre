import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import { sessionCookieOf } from './session-cookie.js';
import { SESSION_COOKIE } from './session.defs.js';

function requestWith(cookie: string | undefined): Request {
  return { headers: cookie === undefined ? {} : { cookie } } as Request;
}

describe('sessionCookieOf', () => {
  it('finds the session among other cookies', () => {
    expect(
      sessionCookieOf(
        requestWith(`theme=dark; ${SESSION_COOKIE}=a.token; lang=az`),
      ),
    ).toBe('a.token');
  });

  it('answers null where there is no cookie header at all', () => {
    expect(sessionCookieOf(requestWith(undefined))).toBeNull();
  });

  it('answers null where the session is not among them', () => {
    expect(sessionCookieOf(requestWith('theme=dark'))).toBeNull();
  });

  it('does not match a cookie whose name merely ends in ours', () => {
    expect(sessionCookieOf(requestWith(`not_${SESSION_COOKIE}=x`))).toBeNull();
  });

  it('answers null for a cookie that is present and empty', () => {
    expect(sessionCookieOf(requestWith(`${SESSION_COOKIE}=`))).toBeNull();
  });
});
