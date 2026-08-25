import { describe, expect, it } from 'vitest';

import { referencesAgree } from './reference.js';

describe('referencesAgree', () => {
  it('forgives spacing, hyphens and a series prefix written apart', () => {
    expect(referencesAgree('AZE 12-34567', 'AZE1234567')).toBe(true);
  });

  it('forgives the separators of a cadastral number', () => {
    expect(referencesAgree('40-12-345-67', '40 12 345 67')).toBe(true);
  });

  it('does not forgive a different digit', () => {
    expect(referencesAgree('40-12-345-67', '40-12-345-68')).toBe(false);
  });

  it('has nothing to compare when a side is empty', () => {
    expect(referencesAgree('', '')).toBe(false);
  });
});
