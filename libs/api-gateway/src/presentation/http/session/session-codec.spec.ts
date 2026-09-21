import { describe, expect, it } from 'vitest';

import { SessionCodec } from './session-codec.js';
import type { SessionOptions } from './session.defs.js';

const OPTIONS: SessionOptions = {
  secret: 'a-secret-long-enough-for-a-test',
  ttlSeconds: 3600,
  secure: false,
};

const ACCOUNT = '11111111-1111-4111-8111-111111111111';

function codec(overrides: Partial<SessionOptions> = {}): SessionCodec {
  return new SessionCodec({ ...OPTIONS, ...overrides });
}

describe('SessionCodec', () => {
  it('opens what it issued', () => {
    const sessions = codec();
    const { token, maxAge } = sessions.issue(ACCOUNT);

    expect(sessions.open(token)).toBe(ACCOUNT);
    expect(maxAge).toBe(OPTIONS.ttlSeconds);
  });

  it('refuses a token signed with another secret', () => {
    const { token } = codec().issue(ACCOUNT);

    expect(codec({ secret: 'a-different-secret-entirely' }).open(token)).toBe(
      null,
    );
  });

  it('refuses a payload edited after signing', () => {
    const sessions = codec();
    const { token } = sessions.issue(ACCOUNT);
    const [, signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'somebody-else', exp: 2 ** 40 }),
      'utf8',
    ).toString('base64url');

    expect(sessions.open(`${forged}.${signature ?? ''}`)).toBeNull();
  });

  it('refuses a token that has expired', () => {
    const sessions = codec({ ttlSeconds: 60 });
    const issuedAt = Date.now();
    const { token } = sessions.issue(ACCOUNT, issuedAt);

    expect(sessions.open(token, issuedAt + 59_000)).toBe(ACCOUNT);
    expect(sessions.open(token, issuedAt + 61_000)).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['no separator', 'justonepart'],
    ['an empty payload', '.signature'],
    ['a payload that is not JSON', `${Buffer.from('nope').toString('base64url')}.x`], // prettier-ignore
    ['a payload with no subject', `${Buffer.from('{"exp":99999999999}').toString('base64url')}.x`], // prettier-ignore
  ])('refuses one that is %s', (_case, token) => {
    expect(codec().open(token)).toBeNull();
  });

  it('carries the account id and nothing else', () => {
    const { token } = codec().issue(ACCOUNT);
    const [payload] = token.split('.');
    const claims: unknown = JSON.parse(
      Buffer.from(payload ?? '', 'base64url').toString('utf8'),
    );

    // No role, no address, no name. The account is read on every request, so a
    // role in here would only be a role that stays true after it changed.
    expect(Object.keys(claims as object).sort()).toEqual(['exp', 'sub']);
  });
});
