import { describe, expect, it } from 'vitest';

import { InvalidLoginException } from '../exceptions/index.js';

import { Login } from './login.vo.js';

describe('Login', () => {
  it('folds case and trims, so one person cannot open two accounts', () => {
    expect(Login.create('  Cadastre-Operator  ').value).toBe(
      'cadastre-operator',
    );
  });

  it('treats two spellings of one login as equal', () => {
    expect(Login.create('aysel').equals(Login.create('  AYSEL '))).toBe(true);
  });

  it('takes an address as an ordinary login, without validating it as one', () => {
    expect(Login.create('Aysel@Example.AZ').value).toBe('aysel@example.az');
  });

  it.each([
    ['empty', '   '],
    ['shorter than three characters', 'ab'],
    ['longer than sixty-four characters', 'a'.repeat(65)],
  ])('refuses one that is %s', (_case, raw) => {
    expect(() => Login.create(raw)).toThrow(InvalidLoginException);
  });

  it('answers null instead of raising where the caller must not tell the two apart', () => {
    // The sign-in's own reading: a malformed login and a wrong password are the
    // same 401, so the refusal must not escape from here.
    expect(Login.safe('ab')).toBeNull();
    expect(Login.safe('cadastre-user')?.value).toBe('cadastre-user');
  });
});
