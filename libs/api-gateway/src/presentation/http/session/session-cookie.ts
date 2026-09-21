import type { Request, Response } from 'express';

import { SESSION_COOKIE, type SessionOptions } from './session.defs.js';

/**
 * Reading the cookie off a request is done here rather than with
 * `cookie-parser`, because parsing one header is smaller than a dependency and
 * a piece of middleware in `main.ts` — and this API has exactly one cookie.
 */
export function sessionCookieOf(request: Request): string | null {
  const header = request.headers.cookie;

  if (typeof header !== 'string') return null;

  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');

    if (separator <= 0) continue;
    if (pair.slice(0, separator).trim() !== SESSION_COOKIE) continue;

    const value = pair.slice(separator + 1).trim();

    return value === '' ? null : decodeURIComponent(value);
  }

  return null;
}

export function setSessionCookie(
  response: Response,
  token: string,
  maxAgeSeconds: number,
  options: SessionOptions,
): void {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: options.secure,
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  });
}

/**
 * Cleared with the same flags it was set with, and that is not a detail: a
 * browser matches a clearing cookie to the one it holds by name, path and
 * domain, and a `path` that differs leaves the old one in place and signs
 * nobody out.
 */
export function clearSessionCookie(
  response: Response,
  options: SessionOptions,
): void {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: options.secure,
    path: '/',
  });
}
