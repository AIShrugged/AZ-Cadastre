import { describe, expect, it } from 'vitest';

import { referenceConfidence, referencesAgree } from './reference.js';

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

describe('referenceConfidence', () => {
  it('is certain about a pair the rule itself accepts', () => {
    expect(referenceConfidence('40-12-345-67', '40 12 345 67')).toBe(1);
  });

  /*
   * A cadastral number typed as far as the operator has it. It is not the same
   * reference and it is not a different one: how much of it was given is the
   * whole of the answer, and what is counted is the skeleton — the separators
   * are formatting on both sides, so `40-12-345` is seven characters of nine.
   */
  it('grades a number typed as far as it is known by how much of it there is', () => {
    expect(referenceConfidence('40-12-345', '40-12-345-67')).toBeCloseTo(
      7 / 9,
      5,
    );
    // Two digits of a parcel number identify no parcel.
    expect(referenceConfidence('40', '40-12-345-67')).toBeLessThan(0.3);
  });

  /*
   * One digit wrong. It is the easiest mistake there is to make, so it is
   * offered — and a reference forgives nothing, so it is never offered as the
   * parcel.
   */
  it('offers a mistyped digit as a possibility and never as a match', () => {
    const near = referenceConfidence('40-12-345-68', '40-12-345-67');

    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(0.8);
  });

  it('says nothing about two references that share less than half their characters', () => {
    expect(referenceConfidence('40-12-345-67', 'AZ-CAD-1024-311')).toBe(0);
  });

  it('has nothing to compare when a side is empty', () => {
    expect(referenceConfidence('', '40-12-345-67')).toBe(0);
  });
});
