import { describe, expect, it } from 'vitest';

import { landPurposeIn, landRightIn } from './land-title.service.js';

describe('landRightIn', () => {
  it('reads ownership in either language', () => {
    expect(landRightIn('Mülkiyyət hüququ')).toBe('Ownership');
    expect(landRightIn('Право собственности')).toBe('Ownership');
    expect(landRightIn('OWNERSHIP')).toBe('Ownership');
  });

  it('reads a lease and a right of use as one answer', () => {
    expect(landRightIn('İcarə hüququ')).toBe('LeaseOrUse');
    expect(landRightIn('İstifadə hüququ')).toBe('LeaseOrUse');
    expect(landRightIn('Право аренды')).toBe('LeaseOrUse');
    expect(landRightIn('Right of USE')).toBe('LeaseOrUse');
  });

  // Two rights on one line are two rights, and choosing between them would
  // decide the provision on whichever word happened to come first.
  it('refuses a line that names both', () => {
    expect(landRightIn('Mülkiyyət; icarə')).toBeNull();
  });

  it('refuses a line that names neither', () => {
    expect(landRightIn('Xüsusi')).toBeNull();
    expect(landRightIn('')).toBeNull();
  });

  // "use" is a word and not a run of letters: "house" is no right of use.
  it('does not find a right of use inside another English word', () => {
    expect(landRightIn('house')).toBeNull();
  });
});

describe('landPurposeIn', () => {
  it('reads a designation for a dwelling in either language', () => {
    expect(landPurposeIn('Fərdi yaşayış tikintisi üçün torpaq')).toBe(
      'Residential',
    );
    expect(
      landPurposeIn('ЗЕМЛИ ПОД ИНДИВИДУАЛЬНОЕ ЖИЛИЩНОЕ СТРОИТЕЛЬСТВО'),
    ).toBe('Residential');
    expect(landPurposeIn('Həyətyanı torpaq sahəsi')).toBe('Residential');
    expect(landPurposeIn('RESIDENTIAL')).toBe('Residential');
  });

  it('reads anything else that is stated as another designation', () => {
    expect(landPurposeIn('Kənd təsərrüfatı təyinatlı torpaqlar')).toBe('Other');
  });

  it('reads nothing out of a value that states no words', () => {
    expect(landPurposeIn('')).toBeNull();
    expect(landPurposeIn('—')).toBeNull();
  });
});
