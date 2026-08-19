import { describe, expect, it } from 'vitest';

import { InvalidFilenameException } from '../exceptions/index.js';

import { Filename } from './filename.vo.js';

describe('Filename', () => {
  it('keeps the name the file arrived under', () => {
    expect(Filename.create('passport.pdf').value).toBe('passport.pdf');
  });

  it('trims the name it was given', () => {
    expect(Filename.create('  scan 001.jpg  ').value).toBe('scan 001.jpg');
  });

  it('refuses an empty name', () => {
    expect(() => Filename.create('')).toThrow(InvalidFilenameException);
  });

  it('refuses a name that is nothing but whitespace', () => {
    expect(() => Filename.create('   ')).toThrow(InvalidFilenameException);
  });

  it('accepts a name of exactly the greatest length', () => {
    const longest = 'a'.repeat(Filename.MAX_LENGTH);

    expect(Filename.create(longest).value).toBe(longest);
  });

  it('refuses a name longer than the greatest length', () => {
    expect(() => Filename.create('a'.repeat(Filename.MAX_LENGTH + 1))).toThrow(
      InvalidFilenameException,
    );
  });

  it('measures the length after trimming', () => {
    const longest = 'a'.repeat(Filename.MAX_LENGTH);

    expect(Filename.create(` ${longest} `).value).toBe(longest);
  });

  it('says why it refuses', () => {
    expect(() => Filename.create(' ')).toThrow(/must not be empty/);
    expect(() => Filename.create('a'.repeat(Filename.MAX_LENGTH + 1))).toThrow(
      /must not be too long/,
    );
  });

  it('never resolves the name: it is shown, not followed', () => {
    expect(Filename.create('../../etc/passwd').value).toBe('../../etc/passwd');
  });

  it('is equal to another filename reading the same', () => {
    expect(Filename.create('a.pdf').equals(Filename.create(' a.pdf '))).toBe(
      true,
    );
    expect(Filename.create('a.pdf').equals(Filename.create('b.pdf'))).toBe(
      false,
    );
  });
});
