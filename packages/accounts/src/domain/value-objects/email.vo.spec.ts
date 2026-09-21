import { describe, expect, it } from 'vitest';

import { InvalidEmailException } from '../exceptions/index.js';

import { Email } from './email.vo.js';

describe('Email', () => {
  it('folds case and trims, so one person cannot open two accounts', () => {
    expect(Email.create('  Operator@Cadastre.AZ  ').value).toBe(
      'operator@cadastre.az',
    );
  });

  it('treats two spellings of one address as equal', () => {
    expect(Email.create('a@b.az').equals(Email.create('  A@B.AZ '))).toBe(true);
  });

  it.each([
    ['empty', '   '],
    ['no @', 'nobody'],
    ['no domain', 'nobody@'],
    ['no name', '@cadastre.az'],
    ['a space in it', 'no body@cadastre.az'],
    ['no dot in the domain', 'nobody@cadastre'],
  ])('refuses one with %s', (_case, raw) => {
    expect(() => Email.create(raw)).toThrow(InvalidEmailException);
  });

  it('answers null instead of raising where the caller must not tell the two apart', () => {
    // The sign-in's own reading: a malformed address and a wrong password are
    // the same 401, so the refusal must not escape from here.
    expect(Email.safe('not-an-address')).toBeNull();
    expect(Email.safe('a@b.az')?.value).toBe('a@b.az');
  });
});
