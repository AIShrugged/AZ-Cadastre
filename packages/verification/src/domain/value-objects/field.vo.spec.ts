import { describe, expect, it } from 'vitest';

import {
  InvalidFieldKeyException,
  InvalidFieldValueException,
} from '../exceptions/index.js';

import { FieldKey, FieldValue } from './field.vo.js';

describe('FieldKey', () => {
  it('accepts any key a profile might define, because the set is open', () => {
    expect(FieldKey.create('first_name').value).toBe('first_name');
    expect(FieldKey.create('parcel_id').value).toBe('parcel_id');
  });

  it('trims the key it was given', () => {
    expect(FieldKey.create('  passport_no  ').value).toBe('passport_no');
  });

  it('refuses an empty key', () => {
    expect(() => FieldKey.create('')).toThrow(InvalidFieldKeyException);
  });

  it('refuses a key that is nothing but whitespace', () => {
    expect(() => FieldKey.create('  \t ')).toThrow(InvalidFieldKeyException);
  });

  it('accepts a key of exactly the greatest length', () => {
    const longest = 'a'.repeat(FieldKey.MAX_LENGTH);

    expect(FieldKey.create(longest).value).toBe(longest);
  });

  it('refuses a key longer than the greatest length', () => {
    expect(() => FieldKey.create('a'.repeat(FieldKey.MAX_LENGTH + 1))).toThrow(
      InvalidFieldKeyException,
    );
  });

  it('says why it refuses', () => {
    expect(() => FieldKey.create(' ')).toThrow(/must not be empty/);
    expect(() => FieldKey.create('a'.repeat(FieldKey.MAX_LENGTH + 1))).toThrow(
      /must not be too long/,
    );
  });

  it('is equal to another key naming the same field', () => {
    expect(FieldKey.create('dob').equals(FieldKey.create(' dob '))).toBe(true);
    expect(FieldKey.create('dob').equals(FieldKey.create('expiry'))).toBe(
      false,
    );
  });
});

describe('FieldValue', () => {
  it('keeps what the extractor pulled out, as text', () => {
    expect(FieldValue.create('AZE1234567').value).toBe('AZE1234567');
  });

  it('stays text, so a date that failed to parse can still be shown', () => {
    expect(FieldValue.create('31/02/2026').value).toBe('31/02/2026');
    expect(FieldValue.create('not a date').value).toBe('not a date');
  });

  it('trims the value it was given', () => {
    expect(FieldValue.create('  Aliyev  ').value).toBe('Aliyev');
  });

  it('refuses an empty value: an absent field is left out, not recorded blank', () => {
    expect(() => FieldValue.create('')).toThrow(InvalidFieldValueException);
  });

  it('refuses a value that is nothing but whitespace', () => {
    expect(() => FieldValue.create('   ')).toThrow(InvalidFieldValueException);
  });

  it('accepts a value of exactly the greatest length', () => {
    const longest = 'a'.repeat(FieldValue.MAX_LENGTH);

    expect(FieldValue.create(longest).value).toBe(longest);
  });

  it('refuses a value longer than the greatest length', () => {
    expect(() =>
      FieldValue.create('a'.repeat(FieldValue.MAX_LENGTH + 1)),
    ).toThrow(InvalidFieldValueException);
  });

  it('says why it refuses', () => {
    expect(() => FieldValue.create(' ')).toThrow(/must not be empty/);
    expect(() =>
      FieldValue.create('a'.repeat(FieldValue.MAX_LENGTH + 1)),
    ).toThrow(/must not be too long/);
  });

  it('is equal to another value reading the same', () => {
    expect(
      FieldValue.create('Aliyev').equals(FieldValue.create(' Aliyev ')),
    ).toBe(true);
    expect(
      FieldValue.create('Aliyev').equals(FieldValue.create('Aliyeva')),
    ).toBe(false);
  });
});
