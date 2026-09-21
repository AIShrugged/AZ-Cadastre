import { describe, expect, it } from 'vitest';

import { InvalidPasswordHashException } from '../exceptions/index.js';

import { PasswordHash } from './password-hash.vo.js';

describe('PasswordHash', () => {
  it('keeps the digest available to the repository', () => {
    expect(PasswordHash.of('$argon2id$v=19$...').value).toBe(
      '$argon2id$v=19$...',
    );
  });

  it('refuses an empty column, which is a row with no credential in it', () => {
    expect(() => PasswordHash.of('   ')).toThrow(InvalidPasswordHashException);
  });

  it('cannot reach a log line by being interpolated into one', () => {
    const hash = PasswordHash.of('$argon2id$v=19$secret');

    expect(`${hash}`).not.toContain('secret');
    expect(JSON.stringify({ hash })).not.toContain('secret');
  });
});
