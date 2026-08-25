import { describe, expect, it } from 'vitest';

import { areasAgree, parseArea } from './area.js';

describe('parseArea', () => {
  it('reads a decimal comma', () => {
    expect(parseArea('120,5 kv.m')).toBe(120.5);
  });

  it('converts sot to square metres', () => {
    expect(parseArea('1,2 sot')).toBe(120);
  });

  it('converts hektar to square metres', () => {
    expect(parseArea('0,012 ha')).toBe(120);
  });

  it('has nothing to say about a string carrying no figure', () => {
    expect(parseArea('DƏK')).toBeNull();
  });
});

describe('areasAgree', () => {
  it('forgives the unit and the decimal separator', () => {
    expect(areasAgree('120,5 kv.m', '120.50 m²')).toBe(true);
  });

  it('forgives a figure given to more places than the other', () => {
    expect(areasAgree('600', '600,00 m2')).toBe(true);
  });

  it('does not forgive a genuinely different area, however small', () => {
    expect(areasAgree('600,00 m2', '600,05 m2')).toBe(false);
  });

  it('does not agree with a figure nobody could read', () => {
    expect(areasAgree('600 m2', 'DƏK')).toBe(false);
  });
});
