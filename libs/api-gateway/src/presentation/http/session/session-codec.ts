import { createHmac, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { SESSION_OPTIONS, type SessionOptions } from './session.defs.js';

/**
 * A session as a signed statement of who somebody is, and until when.
 *
 * `<payload>.<signature>`, both base64url, the payload a JSON object of the
 * account id and an expiry. That is the shape of a JWT with the header left
 * out, and leaving it out is deliberate: a header is a field that says which
 * algorithm to verify with, and a verifier that believes it is the oldest bug
 * in the format. There is one algorithm here — HMAC-SHA256 — and it is not
 * negotiable by the token.
 *
 * Written by hand rather than taken from a library for the same reason: what a
 * library buys is the parts of JWT this does not want. Sixty lines of HMAC with
 * no algorithm field and no key resolution is a smaller thing to be sure of.
 *
 * The token carries the id and nothing else — not the role, not the address.
 * A role inside it would be a role that stays true until the session expires,
 * and the account is read on every request anyway (one primary-key lookup), so
 * an account whose role changed or that was removed stops being what it was at
 * the next request rather than at the next expiry.
 */
@Injectable()
export class SessionCodec {
  constructor(
    @Inject(SESSION_OPTIONS) private readonly options: SessionOptions,
  ) {}

  /** The token, and the seconds a browser should keep it for. */
  issue(
    accountId: string,
    now: number = Date.now(),
  ): {
    token: string;
    maxAge: number;
  } {
    const expiresAt =
      Math.floor(now / 1000) + Math.floor(this.options.ttlSeconds);
    const payload = encode(JSON.stringify({ sub: accountId, exp: expiresAt }));

    return {
      token: `${payload}.${this.sign(payload)}`,
      maxAge: this.options.ttlSeconds,
    };
  }

  /**
   * The account id a token names, or `null` for anything this process will not
   * stand behind: a forgery, a token signed with another secret, one that has
   * expired, one that is not two parts, one whose payload is not the object it
   * should be.
   *
   * One answer for all of them on purpose. The caller has nothing useful to do
   * with the difference, and a message that named it would be a message telling
   * somebody which half of their forgery to fix.
   */
  open(token: string, now: number = Date.now()): string | null {
    const separator = token.indexOf('.');

    if (separator <= 0) return null;

    const payload = token.slice(0, separator);
    const signature = token.slice(separator + 1);

    // Checked before the payload is parsed, never after: a payload that has not
    // been shown to be ours is a string a stranger wrote.
    if (!this.matches(payload, signature)) return null;

    let claims: unknown;

    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }

    if (typeof claims !== 'object' || claims === null) return null;

    const { sub, exp } = claims as { sub?: unknown; exp?: unknown };

    if (typeof sub !== 'string' || sub === '') return null;
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return null;
    if (exp * 1000 <= now) return null;

    return sub;
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.options.secret)
      .update(payload)
      .digest('base64url');
  }

  private matches(payload: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(payload), 'utf8');
    const offered = Buffer.from(signature, 'utf8');

    // Length first: `timingSafeEqual` throws on a mismatch rather than
    // answering, and a thrown comparison is a comparison that took a different
    // amount of time.
    if (expected.length !== offered.length) return false;

    return timingSafeEqual(expected, offered);
  }
}

function encode(json: string): string {
  return Buffer.from(json, 'utf8').toString('base64url');
}
